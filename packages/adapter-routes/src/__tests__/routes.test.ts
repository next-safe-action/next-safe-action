import { ActionValidationError, createSafeActionClient, returnServerError } from "next-safe-action";
import { expect, it, vi } from "vitest";
import { z } from "zod";
import { createRouteHandlers, createRouter } from "../index";
import type { MutationMethod, RouteHandlersOptions, Router } from "../types";

const client = createSafeActionClient({ handleServerError: () => ({ code: "CUSTOM" }) });
function echo(run = async (input: unknown): Promise<unknown> => input) {
	return client.inputSchema(z.unknown()).action(async ({ parsedInput }) => run(parsedInput));
}
// Routes an echo action at POST /users. The config is untyped so tests can pass invalid values.
function users(config: Record<string, unknown> = {}, run?: (input: unknown) => Promise<unknown>) {
	return createRouter().post("/users", echo(run), config);
}
async function call(
	router: Router,
	method: MutationMethod = "POST",
	path = ["users"],
	body: string | undefined = "{}",
	headers: HeadersInit = { "content-type": "application/json" },
	options: RouteHandlersOptions = {}
) {
	return createRouteHandlers(router, options).POST(
		new Request("https://app.test/api/" + path.join("/"), { method, body, headers }),
		{ params: Promise.resolve({ path }) }
	);
}
const passInput = ({ input }: { input: unknown }) => input;

it.each(["POST", "PUT", "PATCH", "DELETE"] as const)("serves %s", async (method) => {
	const add = method.toLowerCase() as "post" | "put" | "patch" | "delete";
	const router = createRouter()[add]("/users", echo(), { successStatus: 201 });
	const response = await call(router, method, undefined, '{"name":"Ada"}');
	expect(response.status).toBe(201);
	expect(await response.json()).toEqual({ data: { name: "Ada" } });
	expect(response.headers.get("cache-control")).toBe("no-store");
});

it("matches concrete paths before parameters and supports mappings", async () => {
	const router = createRouter()
		.post("/users/{id}", echo(), { mapInput: async ({ input, params }) => ({ input, id: params.id }) })
		.put("/users/me", echo());
	const result = await call(router, "POST", ["users", "42"]);
	expect(await result.json()).toEqual({ data: { input: {}, id: "42" } });
	expect((await call(router, "POST", ["users", "me"])).status).toBe(405);
	expect((await call(router, "POST", ["unknown"])).status).toBe(404);
	const wrong = await call(router, "PUT", ["users", "42"]);
	expect(wrong.status).toBe(405);
	expect(wrong.headers.get("allow")).toBe("POST");
});

it("rejects duplicates, ambiguous paths, unsupported configurations and non-actions", () => {
	const base = createRouter().post("/{id}/edit", echo(), { mapInput: passInput });
	expect(() => base.post("/{id}/edit", echo(), { mapInput: passInput })).toThrow("ambiguous");
	expect(() => base.post("/{name}/edit", echo(), { mapInput: passInput })).toThrow("ambiguous");
	expect(() => base.put("/users/{id}", echo(), { mapInput: passInput })).toThrow("ambiguous");
	// Routers are immutable: a failed or successful add never changes the original router.
	expect(base.routes).toHaveLength(1);
	expect(base.put("/{id}/edit", echo(), { mapInput: passInput }).routes).toHaveLength(2);
	expect(base.routes).toHaveLength(1);
	expect(() => createRouter().post("/x", echo().bind(null) as never)).toThrow("not a safe action");
	expect(() => createRouter().post("/x", async () => ({}))).toThrow("not a safe action");
	const bound = client.bindArgsSchemas([z.string()]).action(async () => {});
	expect(() => createRouter().post("/x", bound as never)).toThrow("bind arguments");
	expect(() => users({ successStatus: 204 })).toThrow("JSON body");
	expect(() => users({ mapInput: 1 })).toThrow("functions");
	expect(() => createRouter().post("/{id}/{id}", echo(), { mapInput: passInput })).toThrow("Duplicate path parameter");
	// Without mapInput, path parameters would be silently dropped from the action input.
	expect(() => createRouter().post("/users/{id}", echo(), {} as never)).toThrow("path parameters require mapInput");
	for (const path of ["users", "/users/", "/a//b", "/a/*", "/a/..", "/a/%2F"])
		expect(() => createRouter().post(path as "/", echo())).toThrow("Invalid route");
	expect(() => createRouteHandlers({} as Router)).toThrow("createRouter()");
});

it("rejects invalid JSON, non-JSON bodies and oversized streams", async () => {
	const router = users();
	expect((await call(router, "POST", undefined, "{")).status).toBe(400);
	expect((await call(router, "POST", undefined, "{}", {})).status).toBe(415);
	expect((await call(router, "POST", undefined, "12345", undefined, { maxBodyBytes: 4 })).status).toBe(413);
	// A string body gets an implicit "text/plain" content type, which is rejected even when empty.
	expect((await call(router, "POST", undefined, "", {})).status).toBe(415);
	expect((await call(router, "POST", undefined, "")).status).toBe(200);
	const cancel = vi.fn();
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(new Uint8Array(5));
		},
		cancel,
	});
	const request = new Request("https://app.test", { method: "POST", body: stream, duplex: "half" } as RequestInit);
	const result = await createRouteHandlers(router, { maxBodyBytes: 4 }).POST(request, {
		params: Promise.resolve({ path: ["users"] }),
	});
	expect(result.status).toBe(413);
	expect(cancel).toHaveBeenCalledOnce();
});

it("enforces origins and accepts listed ones without CORS headers", async () => {
	const router = users();
	for (const origin of ["null", "https://evil.test"])
		expect((await call(router, "POST", undefined, "{}", { origin })).status).toBe(403);
	const listed = await call(
		router,
		"POST",
		undefined,
		"{",
		{ "content-type": "application/json", "origin": "https://other.test" },
		{ allowedOrigins: ["https://other.test"] }
	);
	expect(listed.status).toBe(400);
	expect(listed.headers.get("access-control-allow-origin")).toBeNull();
	expect(() => createRouteHandlers(router, { allowedOrigins: ["*"] })).toThrow();
	expect(createRouteHandlers(router)).not.toHaveProperty("OPTIONS");
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
		.inputSchema(z.number())
		.stateAction(async ({ parsedInput }, { prevResult }) => (prevResult.data ?? 0) + parsedInput);
	const router = createRouter().post("/users", state, { stateSchema });
	let response = await call(router, "POST", undefined, '{"input":2}');
	expect(await response.json()).toEqual({ data: 2 });
	expect(validate).not.toHaveBeenCalled();
	response = await call(router, "POST", undefined, '{"input":2,"prevResult":{"data":"3"}}');
	expect(await response.json()).toEqual({ data: 5 });
	expect(validate).toHaveBeenCalledOnce();
	for (const body of ["null", "[]", '{"input":2,"prevResult":null}', '{"unexpected":2}'])
		expect((await call(router, "POST", undefined, body)).status).toBe(400);
	expect(() => createRouter().post("/bad", state, {} as never)).toThrow("stateSchema");
});

it("preserves validation and server errors, void and short-circuit results", async () => {
	const invalid = client.inputSchema(z.string()).action(async () => "ok", { throwValidationErrors: true });
	const response = await call(createRouter().post("/users", invalid, { serverErrorStatus: () => 409 }));
	expect(response.status).toBe(400);
	expect(await response.json()).toHaveProperty("validationErrors");
	const custom = client.action(async () => returnServerError({ code: "CUSTOM" }));
	const error = await call(createRouter().post("/users", custom, { serverErrorStatus: () => 409 }));
	expect(error.status).toBe(409);
	expect(await error.json()).toEqual({ serverError: { code: "CUSTOM" } });
	expect(await (await call(users({}, async () => undefined))).json()).toEqual({});
	const short = client.use(async () => ({ success: true })).action(async () => "unreachable");
	expect(await (await call(createRouter().post("/users", short))).json()).toEqual({});
});

it("sanitizes callbacks and serialization errors, converts navigation and rethrows other signals", async () => {
	const callback = client.action(async () => "ok", {
		onSuccess: async () => {
			throw new Error("SECRET");
		},
	});
	const cyclic: Record<string, unknown> = {};
	cyclic.self = cyclic;
	for (const router of [
		createRouter().post("/users", callback),
		users({}, async () => 1n),
		users({}, async () => cyclic),
		users(
			{
				serverErrorStatus: () => {
					throw new Error("SECRET");
				},
			},
			async () => {
				throw new Error("SECRET");
			}
		),
	]) {
		const response = await call(router);
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ httpError: { code: "INTERNAL_ERROR", message: "Internal server error" } });
	}
	for (const [status, code, message] of [
		[401, "UNAUTHORIZED", "Unauthorized"],
		[403, "FORBIDDEN", "Forbidden"],
		[404, "NOT_FOUND", "Not found"],
	] as const) {
		const router = users({}, async () => {
			throw Object.assign(new Error(), { digest: "NEXT_HTTP_ERROR_FALLBACK;" + status });
		});
		const response = await call(router);
		expect(response.status).toBe(status);
		expect(await response.json()).toEqual({ httpError: { code, message } });
	}
	const redirect = users({}, async () => {
		throw Object.assign(new Error(), { digest: "NEXT_REDIRECT;replace;/next;a;307;" });
	});
	const response = await call(redirect);
	expect(response.status).toBe(303);
	expect(response.headers.get("location")).toBe("/next;a");
	const dynamic = Object.assign(new Error("dynamic"), { digest: "DYNAMIC_SERVER_USAGE" });
	await expect(
		call(
			users({}, async () => {
				throw dynamic;
			})
		)
	).rejects.toBe(dynamic);
});

it("supports root and custom catch-all names and protects protocol headers", async () => {
	const router = createRouter().post("/", echo(), {
		headers: {
			"cache-control": "public",
			"content-type": "text/plain",
			"access-control-allow-origin": "*",
			"x-example": "yes",
		},
	});
	const handlers = createRouteHandlers(router, { pathParam: "segments" });
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

it("exposes only routed actions and adds no enumerable keys to actions", async () => {
	const routed = echo();
	const unrouted = echo();
	const router = createRouter().post("/users", routed);
	expect((await call(createRouter())).status).toBe(404);
	expect((await call(router)).status).toBe(200);
	expect((await call(router, "POST", ["other"])).status).toBe(404);
	expect(router.routes.map((route) => route.action)).toEqual([routed]);
	expect(router.routes.map((route) => route.action)).not.toContain(unrouted);
	expect(Object.keys(routed)).toEqual([]);
});

it("sanitizes raw throws, input mapper failures and invalid error statuses", async () => {
	const raw = createSafeActionClient({
		handleServerError: (error) => {
			throw error;
		},
	}).action(async () => {
		throw new Error("SECRET");
	});
	const routers = [
		createRouter().post("/users", raw),
		users({
			mapInput: () => {
				throw new Error("SECRET");
			},
		}),
		users({ serverErrorStatus: () => 200 }, async () => {
			throw new Error("SECRET");
		}),
	];
	for (const router of routers) {
		const result = await call(router);
		expect(result.status).toBe(500);
		expect(await result.text()).not.toContain("SECRET");
	}
});

it("preserves repeated response headers on thrown validation errors", async () => {
	const a = client.inputSchema(z.string()).action(async () => "ok", { throwValidationErrors: true });
	const router = createRouter().post("/users", a, {
		headers: [
			["set-cookie", "a=1"],
			["set-cookie", "b=2"],
			["x-example", "yes"],
		],
	});
	const result = await call(router);
	expect(result.status).toBe(400);
	expect(result.headers.getSetCookie()).toEqual(["a=1", "b=2"]);
	expect(result.headers.get("x-example")).toBe("yes");
});

it("matches origins against forwarded scheme and host, falling back to the request URL", async () => {
	const run = vi.fn(async () => "ok");
	const router = users({}, run);
	const origin = "https://app.example";
	const send = (headers: Record<string, string>, options: RouteHandlersOptions = {}) =>
		createRouteHandlers(router, options).POST(
			// Next.js builds request.url from the configured hostname, not from the request.
			new Request("http://localhost:3000/api/users", {
				method: "POST",
				body: "{}",
				headers: { "content-type": "application/json", origin, ...headers },
			}),
			{ params: Promise.resolve({ path: ["users"] }) }
		);
	const ok = async (headers: Record<string, string>, options?: RouteHandlersOptions) =>
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

it("applies concrete-path priority and lists only the matched template's methods", async () => {
	const router = createRouter()
		.post("/users/{id}", echo(), { mapInput: passInput })
		.delete("/users/{id}", echo(), { mapInput: passInput })
		.put("/users/me", echo());
	const concrete = await call(router, "POST", ["users", "me"]);
	expect(concrete.status).toBe(405);
	expect(concrete.headers.get("allow")).toBe("PUT");
	const wrong = await call(router, "PUT", ["users", "42"]);
	expect(wrong.headers.get("allow")).toBe("POST, DELETE");
});

it("enforces the exact body limit, strict UTF-8 and JSON media types before running mappers or actions", async () => {
	const mapInput = vi.fn(({ input }: { input: unknown }) => input);
	const run = vi.fn(async (input: unknown) => input);
	const router = users({ mapInput }, run);
	const send = (body: BodyInit, type = "application/json", options: RouteHandlersOptions = {}) =>
		createRouteHandlers(router, options).POST(
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
	// An empty cross-site form post must not run the action with undefined input.
	expect((await send("", "application/x-www-form-urlencoded")).status).toBe(415);
	expect((await send("{}", "application/json", { maxBodyBytes: 1 })).status).toBe(413);
	expect(mapInput).not.toHaveBeenCalled();
	expect(run).not.toHaveBeenCalled();
});

it("keeps hostile keys as own properties and ignores method override headers", async () => {
	const router = createRouter().post("/{__proto__}/{constructor}", echo(), {
		mapInput: ({ input, params }) => ({
			input,
			own: Object.hasOwn(params, "__proto__") && Object.hasOwn(params, "constructor"),
			proto: Object.getPrototypeOf(params) === Object.prototype,
		}),
	});
	const response = await call(router, "POST", ["a", "b"], '{"__proto__":{"polluted":true},"constructor":1}');
	expect(await response.json()).toEqual({
		data: { input: JSON.parse('{"__proto__":{"polluted":true},"constructor":1}'), own: true, proto: true },
	});
	expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
	const remove = createRouter().delete(
		"/users",
		echo(async () => "deleted")
	);
	const override = await call(remove, "POST", undefined, "{}", {
		"content-type": "application/json",
		"x-http-method-override": "DELETE",
	});
	expect(override.status).toBe(405);
});

it("keeps route headers on redirects and access errors", async () => {
	const headers = { "x-example": "yes" };
	const redirect = users({ headers }, async () => {
		throw Object.assign(new Error(), { digest: "NEXT_REDIRECT;replace;/next;307;" });
	});
	const denied = users({ headers }, async () => {
		throw Object.assign(new Error(), { digest: "NEXT_HTTP_ERROR_FALLBACK;403" });
	});
	const moved = await call(redirect);
	expect(moved.status).toBe(303);
	expect(moved.headers.get("x-example")).toBe("yes");
	const forbidden = await call(denied);
	expect(forbidden.status).toBe(403);
	expect(forbidden.headers.get("x-example")).toBe("yes");
});

it("reports the original cause of sanitized failures through onError only", async () => {
	const causes: unknown[] = [];
	const onError = vi.fn((error: unknown, _context: { request: Request }) => {
		causes.push(error);
	});
	const secret = new Error("SECRET");
	const cyclic: Record<string, unknown> = {};
	cyclic.self = cyclic;
	const sanitized = [
		users({
			mapInput: () => {
				throw secret;
			},
		}),
		users({ serverErrorStatus: () => 200 }, async () => {
			throw new Error("boom");
		}),
		users({}, async () => cyclic),
		users({}, async () => {
			throw Object.assign(new Error(), { digest: "NEXT_REDIRECT;replace;/bad\nheader;307;" });
		}),
	];
	for (const router of sanitized) {
		const response = await call(router, "POST", undefined, "{}", undefined, { onError });
		expect(response.status).toBe(500);
		expect(await response.text()).not.toContain("SECRET");
	}
	expect(onError).toHaveBeenCalledTimes(4);
	expect(causes[0]).toBe(secret);
	expect(onError.mock.calls[0]![1]).toHaveProperty("request");
	onError.mockClear();
	const invalid = client.inputSchema(z.string()).action(async () => "ok", { throwValidationErrors: true });
	expect(
		(await call(createRouter().post("/users", invalid), "POST", undefined, "{}", undefined, { onError })).status
	).toBe(400);
	expect((await call(users(), "POST", undefined, "{", undefined, { onError })).status).toBe(400);
	expect(onError).not.toHaveBeenCalled();
	const throwing = await call(sanitized[2]!, "POST", undefined, "{}", undefined, {
		onError: () => {
			throw new Error("reporter");
		},
	});
	expect(throwing.status).toBe(500);
	expect(await throwing.json()).toEqual({ httpError: { code: "INTERNAL_ERROR", message: "Internal server error" } });
	const rejection = vi.fn();
	process.once("unhandledRejection", rejection);
	const asyncThrowing = await call(sanitized[2]!, "POST", undefined, "{}", undefined, {
		onError: async () => {
			throw new Error("async reporter");
		},
	});
	expect(asyncThrowing.status).toBe(500);
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(rejection).not.toHaveBeenCalled();
	expect(() => createRouteHandlers(createRouter(), { onError: 1 as unknown as () => void })).toThrow("onError");
});

it("routes actions and recognizes thrown validation errors from a duplicate core instance", async () => {
	vi.resetModules();
	const duplicate = await import("next-safe-action");
	expect(duplicate.ActionValidationError).not.toBe(ActionValidationError);
	const a = duplicate
		.createSafeActionClient()
		.inputSchema(z.string())
		.action(async () => "ok", { throwValidationErrors: true });
	const response = await call(createRouter().post("/users", a));
	expect(response.status).toBe(400);
	expect(await response.json()).toHaveProperty("validationErrors");
});

it("rejects path parameter values that are empty, dot segments or contain a slash", async () => {
	const run = vi.fn(async (input: unknown) => input);
	const router = createRouter().post("/users/{id}", echo(run), { mapInput: ({ params }) => params.id });
	for (const id of ["", ".", "..", "a/b"]) expect((await call(router, "POST", ["users", id])).status).toBe(404);
	expect(run).not.toHaveBeenCalled();
	expect(await (await call(router, "POST", ["users", "a.b"])).json()).toEqual({ data: "a.b" });
});

it("never treats opaque origins as same-origin", async () => {
	const run = vi.fn(async () => "ok");
	const response = await call(users({}, run), "POST", undefined, "{}", {
		"content-type": "application/json",
		"origin": "chrome-extension://abc",
		"host": "abc",
		"x-forwarded-proto": "foo",
	});
	expect(response.status).toBe(403);
	expect(run).not.toHaveBeenCalled();
});
