import { ActionValidationError, createSafeActionClient, returnServerError } from "next-safe-action";
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

it("reflects allowed origins on success and error responses without implicit credentials", async () => {
	const a = action({ method: "POST", path: "/users" });
	const same = await call([a], "POST", undefined, "{}", {
		"content-type": "application/json",
		"origin": "https://app.test",
	});
	expect(same.status).toBe(200);
	expect(same.headers.get("access-control-allow-origin")).toBe("https://app.test");
	expect(same.headers.get("access-control-allow-credentials")).toBeNull();
	const listed = await call(
		[a],
		"POST",
		undefined,
		"{",
		{ "content-type": "application/json", "origin": "https://other.test" },
		{ allowedOrigins: ["https://other.test"] }
	);
	expect(listed.status).toBe(400);
	expect(listed.headers.get("access-control-allow-origin")).toBe("https://other.test");
	expect(listed.headers.get("vary")).toBe("Origin");
});

it("matches origins against forwarded scheme and host, falling back to the request URL", async () => {
	const run = vi.fn(async () => "ok");
	const a = action({ method: "POST", path: "/users" }, run);
	const origin = "https://app.example";
	const send = (headers: Record<string, string>, options: Partial<RoutesOptions> = {}) =>
		createRouteHandlers({ actions: [a], ...options }).POST(
			// Next.js builds request.url from the configured hostname, not from the request.
			new Request("http://localhost:3000/api/users", {
				method: "POST",
				body: "{}",
				headers: { "content-type": "application/json", origin, ...headers },
			}),
			{ params: Promise.resolve({ path: ["users"] }) }
		);
	const ok = async (headers: Record<string, string>, options?: Partial<RoutesOptions>) =>
		expect((await send(headers, options)).status).toBe(200);
	const denied = async (headers: Record<string, string>) => expect((await send(headers)).status).toBe(403);
	await ok({ "host": "APP.example", "x-forwarded-proto": "https" });
	await ok({ "host": "app.example:443", "x-forwarded-proto": "https, http" });
	await ok({ "host": "internal:3000", "x-forwarded-host": "app.example, proxy", "x-forwarded-proto": "https" });
	await ok({ host: "internal:3000" }, { allowedOrigins: [origin] });
	// Scheme must match: an http origin never counts as same-origin for an https deployment.
	await denied({ "origin": "http://app.example", "host": "app.example", "x-forwarded-proto": "https" });
	// Without a forwarded scheme, the request URL scheme applies.
	await denied({ host: "app.example" });
	await ok({ origin: "http://app.example", host: "app.example" });
	// X-Forwarded-Host takes precedence over Host when present.
	await denied({ "host": "app.example", "x-forwarded-host": "internal", "x-forwarded-proto": "https" });
	await denied({ "host": "app.example:8443", "x-forwarded-proto": "https" });
	await denied({ "host": "internal:3000", "x-forwarded-proto": "https" });
	// The request URL host applies only when no Host header reached the handler.
	await ok({ origin: "http://localhost:3000" });
	await denied({ origin: "http://localhost:3000", host: "app.example" });
	await denied({ origin: "not a url", host: "app.example" });
	expect(run).toHaveBeenCalledTimes(6);
});

it("answers preflight for parameter paths and applies concrete-path priority to preflight", async () => {
	const create = action({ method: "POST", path: "/users/{id}" });
	const remove = action({ method: "DELETE", path: "/users/{id}" });
	const me = action({ method: "PUT", path: "/users/me" });
	const preflight = (path: string[], method: string) =>
		call([create, remove, me], "OPTIONS", path, undefined, {
			"origin": "https://app.test",
			"access-control-request-method": method,
		});
	const parameter = await preflight(["users", "42"], "DELETE");
	expect(parameter.status).toBe(204);
	expect(parameter.headers.get("access-control-allow-methods")).toBe("POST, DELETE, OPTIONS");
	expect((await preflight(["users", "me"], "POST")).status).toBe(405);
	expect((await preflight(["users", "me"], "PUT")).status).toBe(204);
	const wrong = await call([create, remove], "PUT", ["users", "42"]);
	expect(wrong.headers.get("allow")).toBe("POST, DELETE, OPTIONS");
});

it("enforces the exact body limit, strict UTF-8 and JSON media types before running mappers or actions", async () => {
	const mapInput = vi.fn(({ input }: { input: unknown }) => input);
	const run = vi.fn(async (input: unknown) => input);
	const a = action({ method: "POST", path: "/users", mapInput }, run);
	const send = (body: BodyInit, type = "application/json", options: Partial<RoutesOptions> = {}) =>
		createRouteHandlers({ actions: [a], ...options }).POST(
			new Request("https://app.test/api/users", { method: "POST", body, headers: { "content-type": type } }),
			{ params: Promise.resolve({ path: ["users"] }) }
		);
	expect((await send("1234", undefined, { maxBodyBytes: 4 })).status).toBe(200);
	expect((await send("12345", undefined, { maxBodyBytes: 4 })).status).toBe(413);
	expect(await (await send('"héllo"')).json()).toEqual({ data: "héllo" });
	expect((await send(new Uint8Array([0x22, 0xff, 0x22]))).status).toBe(400);
	expect((await send('{"a":1}', "application/vnd.api+json")).status).toBe(200);
	expect(run).toHaveBeenCalledTimes(3);
	run.mockClear();
	mapInput.mockClear();
	expect((await send("{}", "text/plain")).status).toBe(415);
	expect((await send("a=1", "application/x-www-form-urlencoded")).status).toBe(415);
	expect((await send("{}", "application/json", { maxBodyBytes: 1 })).status).toBe(413);
	expect(mapInput).not.toHaveBeenCalled();
	expect(run).not.toHaveBeenCalled();
});

it("keeps hostile keys as own properties and ignores method override headers", async () => {
	const a = action({
		method: "POST",
		path: "/{__proto__}/{constructor}",
		mapInput: ({ input, params }) => ({
			input,
			own: Object.hasOwn(params, "__proto__") && Object.hasOwn(params, "constructor"),
			proto: Object.getPrototypeOf(params) === Object.prototype,
		}),
	});
	const response = await call([a], "POST", ["a", "b"], '{"__proto__":{"polluted":true},"constructor":1}');
	expect(await response.json()).toEqual({
		data: { input: JSON.parse('{"__proto__":{"polluted":true},"constructor":1}'), own: true, proto: true },
	});
	expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
	const remove = action({ method: "DELETE", path: "/users" }, async () => "deleted");
	const override = await call([remove], "POST", undefined, "{}", {
		"content-type": "application/json",
		"x-http-method-override": "DELETE",
	});
	expect(override.status).toBe(405);
});

it("keeps endpoint headers on redirects and access errors", async () => {
	const headers = { "x-example": "yes" };
	const redirect = action({ method: "POST", path: "/users", headers }, async () => {
		throw Object.assign(new Error(), { digest: "NEXT_REDIRECT;replace;/next;307;" });
	});
	const denied = action({ method: "POST", path: "/users", headers }, async () => {
		throw Object.assign(new Error(), { digest: "NEXT_HTTP_ERROR_FALLBACK;403" });
	});
	const moved = await call([redirect]);
	expect(moved.status).toBe(303);
	expect(moved.headers.get("x-example")).toBe("yes");
	const forbidden = await call([denied]);
	expect(forbidden.status).toBe(403);
	expect(forbidden.headers.get("x-example")).toBe("yes");
});

it("reports the original cause of sanitized failures through onError only", async () => {
	const endpoint: EndpointMetadata = { method: "POST", path: "/users" };
	const causes: unknown[] = [];
	const onError = vi.fn((error: unknown, _context: { request: Request }) => {
		causes.push(error);
	});
	const secret = new Error("SECRET");
	const cyclic: Record<string, unknown> = {};
	cyclic.self = cyclic;
	const sanitized = [
		action({
			...endpoint,
			mapInput: () => {
				throw secret;
			},
		}),
		action({ ...endpoint, serverErrorStatus: () => 200 }, async () => {
			throw new Error("boom");
		}),
		action(endpoint, async () => cyclic),
		action(endpoint, async () => {
			throw Object.assign(new Error(), { digest: "NEXT_REDIRECT;replace;/bad\nheader;307;" });
		}),
	];
	for (const a of sanitized) {
		const response = await call([a], "POST", undefined, "{}", undefined, { onError });
		expect(response.status).toBe(500);
		expect(await response.text()).not.toContain("SECRET");
	}
	expect(onError).toHaveBeenCalledTimes(4);
	expect(causes[0]).toBe(secret);
	expect(onError.mock.calls[0]![1]).toHaveProperty("request");
	onError.mockClear();
	const invalid = client
		.metadata({ endpoint })
		.inputSchema(z.string())
		.action(async () => "ok", { throwValidationErrors: true });
	expect((await call([invalid], "POST", undefined, "{}", undefined, { onError })).status).toBe(400);
	expect((await call([action(endpoint)], "POST", undefined, "{", undefined, { onError })).status).toBe(400);
	expect(onError).not.toHaveBeenCalled();
	const throwing = await call([sanitized[2]!], "POST", undefined, "{}", undefined, {
		onError: () => {
			throw new Error("reporter");
		},
	});
	expect(throwing.status).toBe(500);
	expect(await throwing.json()).toEqual({ httpError: { code: "INTERNAL_ERROR", message: "Internal server error" } });
	const rejection = vi.fn();
	process.once("unhandledRejection", rejection);
	const asyncThrowing = await call([sanitized[2]!], "POST", undefined, "{}", undefined, {
		onError: async () => {
			throw new Error("async reporter");
		},
	});
	expect(asyncThrowing.status).toBe(500);
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(rejection).not.toHaveBeenCalled();
	expect(() => createRouteHandlers({ actions: [], onError: 1 as unknown as () => void })).toThrow("onError");
});

it("recognizes thrown validation errors from a duplicate core instance", async () => {
	vi.resetModules();
	const duplicate = await import("next-safe-action");
	expect(duplicate.ActionValidationError).not.toBe(ActionValidationError);
	const a = duplicate
		.createSafeActionClient({ defineMetadataSchema: () => z.object({ endpoint: z.custom<EndpointMetadata>() }) })
		.use(routesMiddleware())
		.metadata({ endpoint: { method: "POST", path: "/users" } })
		.inputSchema(z.string())
		.action(async () => "ok", { throwValidationErrors: true });
	const response = await call([a]);
	expect(response.status).toBe(400);
	expect(await response.json()).toHaveProperty("validationErrors");
});
