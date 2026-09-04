import { createSafeActionClient, returnServerError } from "next-safe-action";
import { expect, it, vi } from "vitest";
import { z } from "zod";
import { createRouteHandlers, routesMiddleware } from "../index";
import type { EndpointMetadata, MutationMethod, RoutesOptions } from "../types";

const client = createSafeActionClient({
	defineMetadataSchema: () => z.object({ endpoint: z.custom<EndpointMetadata>().optional() }),
	handleServerError: () => ({ code: "CUSTOM" }),
}).use(routesMiddleware());
function action(endpoint: EndpointMetadata, run = async (input: unknown): Promise<unknown> => input) {
	return client
		.metadata({ endpoint })
		.inputSchema(z.unknown())
		.action(async ({ parsedInput }) => run(parsedInput));
}
async function call(
	actions: RoutesOptions["actions"],
	method: MutationMethod | "OPTIONS" = "POST",
	path = ["users"],
	body: string | undefined = "{}",
	headers: HeadersInit = { "content-type": "application/json" },
	options: Partial<RoutesOptions> = {}
) {
	const handlers = createRouteHandlers({ actions, ...options });
	return handlers.POST(
		new Request("https://app.test/api/" + path.join("/"), {
			method,
			body: method === "OPTIONS" ? undefined : body,
			headers,
		}),
		{ params: Promise.resolve({ path }) }
	);
}
it.each(["POST", "PUT", "PATCH", "DELETE"] as const)("serves %s and skips ordinary actions", async (method) => {
	const ordinary = createSafeActionClient().action(async () => "hidden");
	const response = await call(
		[ordinary, action({ method, path: "/users", successStatus: 201 })],
		method,
		undefined,
		'{"name":"Ada"}'
	);
	expect(response.status).toBe(201);
	expect(await response.json()).toEqual({ data: { name: "Ada" } });
	expect(response.headers.get("cache-control")).toBe("no-store");
});
it("matches concrete paths before parameters and supports mappings", async () => {
	const parameter = action({
		method: "POST",
		path: "/users/{id}",
		mapInput: async ({ input, params }) => ({ input, id: params.id }),
	});
	const concrete = action({ method: "PUT", path: "/users/me" });
	const result = await call([parameter, concrete], "POST", ["users", "42"]);
	expect(await result.json()).toEqual({ data: { input: {}, id: "42" } });
	expect((await call([parameter, concrete], "POST", ["users", "me"])).status).toBe(405);
	expect((await call([parameter], "POST", ["unknown"])).status).toBe(404);
	const wrong = await call([parameter], "PUT", ["users", "42"]);
	expect(wrong.status).toBe(405);
	expect(wrong.headers.get("allow")).toBe("POST, OPTIONS");
});
it("rejects duplicates, ambiguous paths, unsupported configurations and bound actions", () => {
	const a = action({ method: "POST", path: "/{id}/edit" });
	for (const b of [
		a,
		action({ method: "POST", path: "/{name}/edit" }),
		action({ method: "PUT", path: "/users/{id}" }),
	]) {
		expect(() => createRouteHandlers({ actions: [a, b] })).toThrow(/ambiguous/);
	}
	expect(() => createRouteHandlers({ actions: [a.bind(null)] })).toThrow("Bound");
	expect(() =>
		client
			.metadata({ endpoint: { method: "POST", path: "/x" } })
			.bindArgsSchemas([z.string()])
			.action(async () => {})
	).toThrow("bind");
	expect(() => action({ method: "POST", path: "/x", successStatus: 204 })).toThrow("JSON body");
	expect(() => action({ method: "POST", path: "/{id}/{id}" })).toThrow("parameter");
	const required = createSafeActionClient().use(routesMiddleware({ requireEndpoint: true }));
	expect(() => required.action(async () => {})).toThrow("required");
});
it("rejects invalid JSON, non-JSON bodies and oversized streams", async () => {
	const a = action({ method: "POST", path: "/users" });
	expect((await call([a], "POST", undefined, "{")).status).toBe(400);
	expect((await call([a], "POST", undefined, "{}", {})).status).toBe(415);
	expect((await call([a], "POST", undefined, "12345", undefined, { maxBodyBytes: 4 })).status).toBe(413);
	expect((await call([a], "POST", undefined, "", {})).status).toBe(200);
	const cancel = vi.fn();
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(new Uint8Array(5));
		},
		cancel,
	});
	const request = new Request("https://app.test", { method: "POST", body: stream, duplex: "half" } as RequestInit);
	const result = await createRouteHandlers({ actions: [a], maxBodyBytes: 4 }).POST(request, {
		params: Promise.resolve({ path: ["users"] }),
	});
	expect(result.status).toBe(413);
	expect(cancel).toHaveBeenCalledOnce();
});
it("enforces origins and path-specific preflight without wildcard credentials", async () => {
	const a = action({ method: "POST", path: "/users" });
	for (const origin of ["null", "https://evil.test"])
		expect((await call([a], "POST", undefined, "{}", { origin })).status).toBe(403);
	const headers = {
		"origin": "https://other.test",
		"access-control-request-method": "POST",
		"access-control-request-headers": "content-type",
	};
	const response = await call([a], "OPTIONS", undefined, undefined, headers, {
		allowedOrigins: ["https://other.test"],
		credentials: true,
	});
	expect(response.status).toBe(204);
	expect(response.headers.get("access-control-allow-origin")).toBe(headers.origin);
	expect(response.headers.get("access-control-allow-credentials")).toBe("true");
	expect(
		(await call([a], "OPTIONS", ["missing"], undefined, headers, { allowedOrigins: [headers.origin] })).status
	).toBe(404);
	expect(
		(
			await call([a], "OPTIONS", undefined, undefined, {
				"origin": "https://app.test",
				"access-control-request-headers": "x-secret",
			})
		).status
	).toBe(403);
	expect(() => createRouteHandlers({ actions: [a], allowedOrigins: ["*"] })).toThrow();
});
it("validates previous state once, applies transforms and defaults omitted state", async () => {
	const validate = vi.fn((value: unknown) => z.object({ data: z.coerce.number() }).safeParse(value));
	const stateSchema = {
		"~standard": {
			version: 1 as const,
			vendor: "test",
			validate: (value: unknown) => {
				const parsed = validate(value);
				return parsed.success ? { value: parsed.data } : { issues: [{ message: "invalid" }] };
			},
		},
	};
	const state = client
		.metadata({ endpoint: { method: "POST", path: "/users", stateSchema, mapInput: ({ input }) => input } })
		.inputSchema(z.number())
		.stateAction(async ({ parsedInput }, { prevResult }) => (prevResult.data ?? 0) + parsedInput);
	let response = await call([state], "POST", undefined, '{"input":2}');
	expect(await response.json()).toEqual({ data: 2 });
	expect(validate).not.toHaveBeenCalled();
	response = await call([state], "POST", undefined, '{"input":2,"prevResult":{"data":"3"}}');
	expect(await response.json()).toEqual({ data: 5 });
	expect(validate).toHaveBeenCalledOnce();
	for (const body of ["null", "[]", '{"input":2,"prevResult":null}', '{"unexpected":2}'])
		expect((await call([state], "POST", undefined, body)).status).toBe(400);
	expect(() => client.metadata({ endpoint: { method: "POST", path: "/bad" } }).stateAction(async () => {})).toThrow(
		"stateSchema"
	);
});
it("preserves validation and server errors, void and short-circuit results", async () => {
	const endpoint: EndpointMetadata = { method: "POST", path: "/users", serverErrorStatus: () => 409 };
	const invalid = client
		.metadata({ endpoint })
		.inputSchema(z.string())
		.action(async () => "ok", { throwValidationErrors: true });
	const response = await call([invalid]);
	expect(response.status).toBe(400);
	expect(await response.json()).toHaveProperty("validationErrors");
	const custom = client.metadata({ endpoint }).action(async () => returnServerError({ code: "CUSTOM" }));
	const error = await call([custom]);
	expect(error.status).toBe(409);
	expect(await error.json()).toEqual({ serverError: { code: "CUSTOM" } });
	expect(await (await call([action(endpoint, async () => undefined)])).json()).toEqual({});
	const short = client
		.use(async () => ({ success: true }))
		.metadata({ endpoint })
		.action(async () => "unreachable");
	expect(await (await call([short])).json()).toEqual({});
});
it("sanitizes callbacks and serialization errors, converts navigation and rethrows other signals", async () => {
	const endpoint: EndpointMetadata = { method: "POST", path: "/users" };
	const callback = client.metadata({ endpoint }).action(async () => "ok", {
		onSuccess: async () => {
			throw new Error("SECRET");
		},
	});
	const cyclic: Record<string, unknown> = {};
	cyclic.self = cyclic;
	for (const a of [
		callback,
		action(endpoint, async () => 1n),
		action(endpoint, async () => cyclic),
		action(
			{
				...endpoint,
				serverErrorStatus: () => {
					throw new Error("SECRET");
				},
			},
			async () => {
				throw new Error("SECRET");
			}
		),
	]) {
		const response = await call([a]);
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ httpError: { code: "INTERNAL_ERROR", message: "Internal server error" } });
	}
	for (const status of [401, 403, 404]) {
		const a = action(endpoint, async () => {
			throw Object.assign(new Error(), { digest: "NEXT_HTTP_ERROR_FALLBACK;" + status });
		});
		expect((await call([a])).status).toBe(status);
	}
	const redirect = action(endpoint, async () => {
		throw Object.assign(new Error(), { digest: "NEXT_REDIRECT;replace;/next;a;307;" });
	});
	const response = await call([redirect]);
	expect(response.status).toBe(303);
	expect(response.headers.get("location")).toBe("/next;a");
	const dynamic = Object.assign(new Error("dynamic"), { digest: "DYNAMIC_SERVER_USAGE" });
	await expect(
		call([
			action(endpoint, async () => {
				throw dynamic;
			}),
		])
	).rejects.toBe(dynamic);
});

it("supports root and custom catch-all names and protects protocol headers", async () => {
	const a = action({
		method: "POST",
		path: "/",
		headers: {
			"cache-control": "public",
			"content-type": "text/plain",
			"access-control-allow-origin": "*",
			"x-example": "yes",
		},
	});
	const handlers = createRouteHandlers({ actions: [a], pathParam: "segments" });
	const result = await handlers.POST(new Request("https://app.test", { method: "POST" }), {
		params: Promise.resolve({}),
	});
	expect(result.status).toBe(200);
	expect(result.headers.get("cache-control")).toBe("no-store");
	expect(result.headers.get("content-type")).toBe("application/json");
	expect(result.headers.get("access-control-allow-origin")).toBeNull();
	expect(result.headers.get("x-example")).toBe("yes");
	const missing = await handlers.POST(new Request("https://app.test", { method: "POST" }), {
		params: Promise.resolve({ segments: ["missing"] }),
	});
	expect(missing.status).toBe(404);
});

it("requires middleware, metadata and registration together", async () => {
	const ordinary = createSafeActionClient({
		defineMetadataSchema: () => z.object({ endpoint: z.custom<EndpointMetadata>() }),
	})
		.metadata({ endpoint: { method: "POST", path: "/users" } })
		.action(async () => "hidden");
	const noMetadata = client.metadata({}).action(async () => "hidden");
	const enabled = action({ method: "POST", path: "/users" });
	expect((await call([ordinary, noMetadata])).status).toBe(404);
	expect((await call([])).status).toBe(404);
	expect((await call([enabled])).status).toBe(200);
	expect(Object.keys(enabled)).toEqual([]);
});

it("sanitizes raw throws, input mapper failures and invalid error statuses", async () => {
	const endpoint: EndpointMetadata = { method: "POST", path: "/users" };
	const raw = createSafeActionClient({
		defineMetadataSchema: () => z.object({ endpoint: z.custom<EndpointMetadata>() }),
		handleServerError: (error) => {
			throw error;
		},
	})
		.use(routesMiddleware())
		.metadata({ endpoint })
		.action(async () => {
			throw new Error("SECRET");
		});
	const mapped = action({
		...endpoint,
		mapInput: () => {
			throw new Error("SECRET");
		},
	});
	const invalidStatus = action({ ...endpoint, serverErrorStatus: () => 200 }, async () => {
		throw new Error("SECRET");
	});
	for (const a of [raw, mapped, invalidStatus]) {
		const result = await call([a]);
		expect(result.status).toBe(500);
		expect(await result.text()).not.toContain("SECRET");
	}
});

it("preserves repeated response headers on thrown validation errors", async () => {
	const a = client
		.metadata({
			endpoint: {
				method: "POST",
				path: "/users",
				headers: [
					["set-cookie", "a=1"],
					["set-cookie", "b=2"],
					["x-example", "yes"],
				],
			},
		})
		.inputSchema(z.string())
		.action(async () => "ok", { throwValidationErrors: true });
	const result = await call([a]);
	expect(result.status).toBe(400);
	expect(result.headers.getSetCookie()).toEqual(["a=1", "b=2"]);
	expect(result.headers.get("x-example")).toBe("yes");
});
