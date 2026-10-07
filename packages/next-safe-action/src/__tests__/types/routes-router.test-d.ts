import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import { createSafeActionClient } from "../../index";
import { createRouteHandlers, createRouter, mergeRouters } from "../../routes";
import type { Router } from "../../routes";
import { generateOpenApiDocument } from "../../routes/openapi";

const client = createSafeActionClient({ handleServerError: () => ({ code: "ERROR" as const }) });
const update = client.inputSchema(z.object({ id: z.string(), title: z.string() })).action(async () => "ok");
const noInput = client.action(async () => "ok");
const counter = client.inputSchema(z.number()).stateAction(async () => 1);

test("config is optional for plain paths and returns a router", () => {
	expectTypeOf(createRouter().post("/todos", noInput)).toEqualTypeOf<Router>();
	createRouter().post("/todos", update, { successStatus: 201 });
});

test("path parameters are typed and require mapInput", () => {
	createRouter().put("/todos/{id}", update, {
		mapInput: ({ input, params }) => {
			expectTypeOf(params).toEqualTypeOf<Readonly<Record<"id", string>>>();
			expectTypeOf(input).toBeUnknown();
			return { ...(input as { title: string }), id: params.id };
		},
	});
	// @ts-expect-error: a path with parameters needs a config with mapInput.
	createRouter().put("/todos/{id}", update);
	// @ts-expect-error: mapInput is required.
	createRouter().put("/todos/{id}", update, { successStatus: 200 });
	createRouter().put("/todos/{id}", update, {
		// @ts-expect-error: the parameter name must exist in the path.
		mapInput: ({ params }) => ({ id: params.todoId, title: "" }),
	});
});

test("mapInput must return the action input", () => {
	createRouter().post("/todos", update, {
		// @ts-expect-error: title is missing.
		mapInput: () => ({ id: "1" }),
	});
	createRouter().post("/todos", update, { mapInput: async () => ({ id: "1", title: "a" }) });
});

test("stateful actions require stateSchema, and other actions reject it", () => {
	createRouter().post("/counter", counter, { stateSchema: z.object({ data: z.number().optional() }) });
	// @ts-expect-error: stateSchema is required for stateful actions.
	createRouter().post("/counter", counter);
	// @ts-expect-error: stateSchema is only for stateful actions.
	createRouter().post("/todos", noInput, { stateSchema: z.object({}) });
});

test("serverErrorStatus receives the action's server error type", () => {
	createRouter().post("/todos", noInput, {
		serverErrorStatus: (error) => {
			expectTypeOf(error).toEqualTypeOf<{ code: "ERROR" }>();
			return 409;
		},
	});
});

test("prefix parameters are typed and require mapInput", () => {
	createRouter({ prefix: "/orgs/{org}" }).put("/todos/{id}", update, {
		mapInput: ({ params }) => {
			expectTypeOf(params).toEqualTypeOf<Readonly<Record<"org" | "id", string>>>();
			return { id: params.id, title: params.org };
		},
	});
	// @ts-expect-error: the prefix has a parameter, so mapInput is required.
	createRouter({ prefix: "/orgs/{org}" }).post("/todos", noInput);
	createRouter({ prefix: "/todos" }).post("/", noInput);
});

test("prefixed routers chain, merge and reach the handlers and OpenAPI", () => {
	const todos = createRouter({ prefix: "/todos" }).post("/", noInput);
	expectTypeOf(todos).toEqualTypeOf<Router<"/todos">>();
	const api = mergeRouters(todos, createRouter().post("/ping", noInput));
	expectTypeOf(api).toEqualTypeOf<Router>();
	mergeRouters(createRouter({ prefix: "/orgs/{org}" }));
	createRouteHandlers(createRouter({ prefix: "/orgs/{org}" }));
	// The merged router has no prefix.
	api.post("/todos/{id}", update, { mapInput: ({ params }) => ({ id: params.id, title: "" }) });
	createRouteHandlers(todos);
	generateOpenApiDocument(todos, { info: { title: "t", version: "1" } });
});
