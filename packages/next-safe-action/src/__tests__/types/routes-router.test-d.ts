import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import { createSafeActionClient } from "../../index";
import { createRouteHandlers, createRouter, HttpStatus, mergeRouters } from "../../routes";
import type { ErrorStatus, Router, RouteOpenApi, SuccessStatus } from "../../routes";
import { generateOpenApiDocument } from "../../routes/openapi";

const client = createSafeActionClient({ handleServerError: () => ({ code: "ERROR" as const }) });
const update = client.inputSchema(z.object({ id: z.string(), title: z.string() })).action(async () => "ok");
const numericId = client.inputSchema(z.object({ id: z.number() })).action(async () => "ok");
const coercedId = client.inputSchema(z.object({ id: z.coerce.number() })).action(async () => "ok");
const optionalInput = client.inputSchema(z.object({ id: z.string() }).optional()).action(async () => "ok");
const primitive = client.inputSchema(z.string()).action(async () => "ok");
const noInput = client.action(async () => "ok");
const counter = client.inputSchema(z.number()).stateAction(async () => 1);
const statefulTodo = client.inputSchema(z.object({ id: z.string() })).stateAction(async () => 1);
const stateSchema = z.object({ data: z.number().optional() });

test("config is optional for plain paths and returns a router", () => {
	expectTypeOf(createRouter().post(noInput, "/todos")).toEqualTypeOf<Router>();
	createRouter().post(update, "/todos", { successStatus: 201 });
	// @ts-expect-error: unknown config keys are rejected.
	createRouter().post(update, "/todos", { sucessStatus: 201 });
});

test("path parameters merge into the input without config", () => {
	createRouter().put(update, "/todos/{id}");
	createRouter().put(coercedId, "/todos/{id}");
	createRouter().delete(optionalInput, "/todos/{id}");
	createRouter().post(statefulTodo, "/todos/{id}", { stateSchema });
	// @ts-expect-error: the parameter is not a key of the action input.
	createRouter().put(update, "/todos/{todoId}");
	// @ts-expect-error: the input key does not accept a string.
	createRouter().put(numericId, "/todos/{id}");
	// @ts-expect-error: a primitive input cannot receive path parameters.
	createRouter().delete(primitive, "/todos/{id}");
	// @ts-expect-error: an action without input cannot receive path parameters.
	createRouter().delete(noInput, "/todos/{id}");
});

test("mapInput is the escape hatch for parameters that do not merge", () => {
	createRouter().put(update, "/todos/{todoId}", {
		mapInput: ({ input, params }) => {
			expectTypeOf(params).toEqualTypeOf<Readonly<Record<"todoId", string>>>();
			expectTypeOf(input).toBeUnknown();
			return { ...(input as { title: string }), id: params.todoId };
		},
	});
	createRouter().delete(primitive, "/todos/{id}", { mapInput: ({ params }) => params.id });
	createRouter().put(numericId, "/todos/{id}", { mapInput: ({ params }) => ({ id: Number(params.id) }) });
	createRouter().put(update, "/todos/{id}", {
		// @ts-expect-error: the parameter name must exist in the path.
		mapInput: ({ params }) => ({ id: params.todoId, title: "" }),
	});
});

test("mapInput must return the action input", () => {
	createRouter().post(update, "/todos", {
		// @ts-expect-error: title is missing.
		mapInput: () => ({ id: "1" }),
	});
	createRouter().post(update, "/todos", { mapInput: async () => ({ id: "1", title: "a" }) });
});

test("stateful actions require stateSchema, and other actions reject it", () => {
	createRouter().post(counter, "/counter", { stateSchema });
	// @ts-expect-error: stateSchema is required for stateful actions.
	createRouter().post(counter, "/counter");
	// @ts-expect-error: stateSchema is only for stateful actions.
	createRouter().post(noInput, "/todos", { stateSchema: z.object({}) });
});

test("serverErrorStatus receives the action's server error type", () => {
	createRouter().post(noInput, "/todos", {
		serverErrorStatus: (error) => {
			expectTypeOf(error).toEqualTypeOf<{ code: "ERROR" }>();
			return 409;
		},
	});
});

test("HttpStatus values are literal types that match the status unions", () => {
	expectTypeOf(HttpStatus.Conflict).toEqualTypeOf<409>();
	expectTypeOf<200 | 201 | 202 | 203 | 206 | 207 | 208 | 226>().toEqualTypeOf<SuccessStatus>();
	expectTypeOf<typeof HttpStatus.NoContent>().not.toExtend<SuccessStatus>();
	expectTypeOf<typeof HttpStatus.InternalServerError>().toExtend<ErrorStatus>();
	expectTypeOf<typeof HttpStatus.Ok>().not.toExtend<ErrorStatus>();
	// @ts-expect-error: HttpStatus is read-only.
	HttpStatus.Ok = 201;
});

test("successStatus takes a 2xx status that allows a body", () => {
	createRouter().post(update, "/todos", { successStatus: HttpStatus.Created });
	createRouter().post(update, "/todos", { successStatus: 202 });
	// @ts-expect-error: 204 does not allow a body.
	createRouter().post(update, "/todos", { successStatus: HttpStatus.NoContent });
	// @ts-expect-error: not a success status.
	createRouter().post(update, "/todos", { successStatus: 404 });
	const status: number = 201;
	// @ts-expect-error: a plain number is not a known status.
	createRouter().post(update, "/todos", { successStatus: status });
});

test("serverErrorStatus returns a 4xx or 5xx status", () => {
	createRouter().post(noInput, "/todos", { serverErrorStatus: () => HttpStatus.Conflict });
	createRouter().post(noInput, "/todos", { serverErrorStatus: (error) => (error.code === "ERROR" ? 409 : 500) });
	// @ts-expect-error: not an error status.
	createRouter().post(noInput, "/todos", { serverErrorStatus: () => 200 });
	// @ts-expect-error: a plain number is not a known status.
	createRouter().post(noInput, "/todos", { serverErrorStatus: (): number => 409 });
});

test("serverErrorStatus may only return the statuses listed in serverErrorStatuses", () => {
	createRouter().post(noInput, "/todos", {
		serverErrorStatus: (error) => (error.code === "ERROR" ? HttpStatus.Conflict : 500),
		openapi: { operationId: "a", serverErrorStatuses: [409, HttpStatus.InternalServerError] },
	});
	// Listing a status that the mapper never returns is allowed: it only documents an extra response.
	createRouter().post(noInput, "/todos", {
		serverErrorStatus: () => 409,
		openapi: { operationId: "b", serverErrorStatuses: [409, 500] },
	});
	createRouter().put(update, "/todos/{id}", {
		// @ts-expect-error: 409 is not listed.
		serverErrorStatus: (error) => (error.code === "ERROR" ? 409 : 500),
		openapi: { operationId: "c", serverErrorStatuses: [500] },
	});
	createRouter().post(counter, "/counter", {
		stateSchema,
		// @ts-expect-error: 500 is not listed.
		serverErrorStatus: (error) => (error.code === "ERROR" ? 409 : 500),
		openapi: { operationId: "d", serverErrorStatuses: [HttpStatus.Conflict] },
	});
	createRouter().put(update, "/todos/{todoId}", {
		mapInput: ({ params }) => ({ id: params.todoId, title: "" }),
		serverErrorStatus: () => 409,
		openapi: { operationId: "e", serverErrorStatuses: [409] },
	});
	// A shared OpenAPI object without literal statuses allows every error status.
	const openapi: RouteOpenApi = { operationId: "f", tags: ["todos"] };
	createRouter().post(noInput, "/todos", { serverErrorStatus: (): ErrorStatus => 404, openapi });
	// Without an OpenAPI list there is nothing to check against.
	createRouter().post(noInput, "/todos", { serverErrorStatus: () => 503 });
});

test("prefix parameters are typed and checked against the input", () => {
	const orgTodo = client.inputSchema(z.object({ org: z.string(), id: z.string() })).action(async () => "ok");
	createRouter({ prefix: "/orgs/{org}" }).put(orgTodo, "/todos/{id}");
	createRouter({ prefix: "/orgs/{org}" }).put(update, "/todos/{id}", {
		mapInput: ({ params }) => {
			expectTypeOf(params).toEqualTypeOf<Readonly<Record<"org" | "id", string>>>();
			return { id: params.id, title: params.org };
		},
	});
	// @ts-expect-error: the prefix parameter is not a key of the action input.
	createRouter({ prefix: "/orgs/{org}" }).put(update, "/todos/{id}");
	// @ts-expect-error: the action has no input for the prefix parameter.
	createRouter({ prefix: "/orgs/{org}" }).post(noInput, "/todos");
	createRouter({ prefix: "/todos" }).post(noInput, "/");
});

test("prefixed routers chain, merge and reach the handlers and OpenAPI", () => {
	const todos = createRouter({ prefix: "/todos" }).post(noInput, "/");
	expectTypeOf(todos).toEqualTypeOf<Router<"/todos">>();
	const api = mergeRouters(todos, createRouter().post(noInput, "/ping"));
	expectTypeOf(api).toEqualTypeOf<Router>();
	mergeRouters(createRouter({ prefix: "/orgs/{org}" }));
	createRouteHandlers(createRouter({ prefix: "/orgs/{org}" }));
	// The merged router has no prefix.
	api.post(update, "/todos/{id}");
	createRouteHandlers(todos);
	generateOpenApiDocument(todos, { info: { title: "t", version: "1" } });
});
