import { createSafeActionClient } from "next-safe-action";
import { expect, it, vi } from "vitest";
import { z } from "zod";
import { createRouter } from "../index";
import { generateOpenApiDocument } from "../openapi";
import type { OpenApiDocumentOptions } from "../openapi";
import type { RouteOpenApi, Router } from "../types";

const errors = { serverErrorSchema: { type: "string" }, validationErrorsSchema: { type: "object" } };
const client = createSafeActionClient();
const info = { title: "Example", version: "1" };
const openapi: RouteOpenApi = { operationId: "createUser" };
const passInput = ({ input }: { input: unknown }) => input as never;
const generate = (router: Router, options: Partial<OpenApiDocumentOptions> = {}) =>
	generateOpenApiDocument(router, { info, ...errors, ...options });

it("generates opt-in operations without executing actions or callbacks", () => {
	const execution = vi.fn(async () => "value");
	const mapping = vi.fn(({ input }) => input);
	const a = client.inputSchema(z.string()).outputSchema(z.string()).action(execution);
	const hidden = client.action(execution);
	const mapped = client.outputSchema(z.string()).action(execution);
	const document = generate(
		createRouter()
			.post("/users", a, { openapi })
			.put("/users", hidden)
			.post("/mapped", mapped, {
				mapInput: mapping,
				openapi: { operationId: "mapped", requestBodySchema: false, parameters: [] },
			})
	);
	expect(document.openapi).toBe("3.1.1");
	expect(Object.keys(document.paths["/users"]!)).toEqual(["post"]);
	expect(document.components.schemas.mapped_Request).toBe(false);
	expect(execution).not.toHaveBeenCalled();
	expect(mapping).not.toHaveBeenCalled();
});
it("requires explicit errors, output and mapping contracts", () => {
	const noOutput = client.action(async () => {});
	expect(() => generate(createRouter().post("/users", noOutput, { openapi }))).toThrow("createUser_Output");
	const withOutput = client.outputSchema(z.string()).action(async () => "ok");
	expect(() => generate(createRouter().post("/users", withOutput, { mapInput: passInput, openapi }))).toThrow(
		"mapInput"
	);
	expect(() => generateOpenApiDocument(createRouter().post("/users", withOutput, { openapi }), { info })).toThrow(
		"serverErrorSchema"
	);
});
it("does not execute dynamic factories and identifies missing schemas", () => {
	const factory = vi.fn(async () => z.string());
	const a = client
		.inputSchema(factory)
		.outputSchema(z.string())
		.action(async () => "ok");
	expect(() => generate(createRouter().post("/users", a, { openapi }))).toThrow("dynamic input");
	const schemas = generate(
		createRouter().post("/users", a, {
			openapi: { operationId: "createUser", requestBodySchema: { type: "string" } },
		})
	).components.schemas;
	expect(schemas.createUser_Request).toEqual({ type: "string" });
	expect(factory).not.toHaveBeenCalled();
	const transformed = client.outputSchema(z.string().transform(Number)).action(async () => 1);
	expect(() => generate(createRouter().post("/users", transformed, { openapi }))).toThrow("createUser_Output");
});
it("flattens recursive roots and definitions into components and keeps nullable and boolean schemas", () => {
	const recursive = {
		$defs: { node: { type: ["object", "null"], properties: { child: { $ref: "#/$defs/node" }, root: { $ref: "#" } } } },
		$ref: "#/$defs/node",
	};
	const a = client.action(async () => {});
	const schemas = generate(
		createRouter().post("/users", a, {
			openapi: { operationId: "recursive", requestBodySchema: recursive, outputSchema: true },
		})
	).components.schemas;
	expect(schemas.recursive_Request).toEqual({ $ref: "#/components/schemas/recursive_Request_node" });
	expect(schemas.recursive_Request_node).toEqual({
		type: ["object", "null"],
		properties: {
			child: { $ref: "#/components/schemas/recursive_Request_node" },
			root: { $ref: "#/components/schemas/recursive_Request" },
		},
	});
	expect(schemas.recursive_Output).toBe(true);
});
it("documents state envelopes and mapped errors without running validation", () => {
	const a = client
		.inputSchema(z.number())
		.outputSchema(z.number())
		.stateAction(async () => 1);
	const doc = generate(
		createRouter().post("/users", a, {
			stateSchema: z.object({ data: z.number() }),
			serverErrorStatus: () => 409,
			openapi: { operationId: "state", serverErrorStatuses: [409] },
		})
	);
	const operation = doc.paths["/users"]!.post as {
		requestBody: { content: Record<string, { schema: { properties: Record<string, unknown> } }> };
		responses: Record<string, unknown>;
	};
	expect(operation.requestBody.content["application/json"]!.schema.properties).toHaveProperty("prevResult");
	expect(operation.responses).toHaveProperty("409");
});

it("uses Standard JSON Schema input/output sides and never validates schemas", () => {
	const input = vi.fn(() => ({ type: "string" }));
	const output = vi.fn(() => ({ type: "number" }));
	const validate = vi.fn(() => ({ value: 1 }));
	const schema = { "~standard": { version: 1 as const, vendor: "test", validate, jsonSchema: { input, output } } };
	const a = client
		.inputSchema(schema)
		.outputSchema(schema)
		.stateAction(async () => 1);
	generate(createRouter().post("/users", a, { stateSchema: schema, openapi }));
	expect(input).toHaveBeenCalledTimes(2);
	expect(input).toHaveBeenCalledWith({ target: "draft-2020-12" });
	expect(output).toHaveBeenCalledExactlyOnceWith({ target: "draft-2020-12" });
	expect(validate).not.toHaveBeenCalled();
});

it("rewrites converted recursive root references to their own component", () => {
	const node: z.ZodType<{ children: unknown[] }> = z.object({ children: z.array(z.lazy(() => node)) });
	const a = client
		.inputSchema(node)
		.outputSchema(node)
		.action(async ({ parsedInput }) => parsedInput);
	const schemas = generate(createRouter().post("/users", a, { openapi })).components.schemas;
	const input = schemas.createUser_Input as Record<string, unknown>;
	const output = schemas.createUser_Output as Record<string, unknown>;
	expect(JSON.stringify(input)).toContain('"$ref":"#/components/schemas/createUser_Input"');
	expect(JSON.stringify(output)).toContain('"$ref":"#/components/schemas/createUser_Output"');
	expect(input).not.toHaveProperty("$schema");
});

it("reports missing status and parameter contracts and duplicate schema components", () => {
	const a = client.outputSchema(z.string()).action(async () => "ok");
	expect(() => generate(createRouter().post("/users", a, { serverErrorStatus: () => 409, openapi }))).toThrow(
		"serverErrorStatuses"
	);
	expect(() =>
		generate(
			createRouter().post("/users/{id}", a, {
				mapInput: passInput,
				openapi: { operationId: "parameter", requestBodySchema: true, parameters: [] },
			})
		)
	).toThrow("missing required path parameter");
	// Identical $id values do not collide: $id is dropped when a schema is flattened into components.
	const sharedId = generate(
		createRouter().post("/users", a, {
			openapi: {
				operationId: "shared",
				requestBodySchema: { $id: "https://example.test/shared", $schema: "x" },
				outputSchema: { $id: "https://example.test/shared" },
			},
		})
	);
	expect(sharedId.components.schemas.shared_Request).toEqual({});
	// "$defs" keys are sanitized into component names, so distinct keys can still collide.
	expect(() =>
		generate(
			createRouter().post("/users", a, {
				openapi: { operationId: "a", requestBodySchema: { $defs: { "x y": {}, "x_y": {} } } },
			})
		)
	).toThrow("a_Request_x_y: duplicate schema component");
	expect(() =>
		generate(
			createRouter()
				.post("/users", a, { openapi: { operationId: "x", outputSchema: { $defs: { ServerError: {} } } } })
				.post("/other", a, { openapi: { operationId: "x_Output" } })
		)
	).toThrow("duplicate schema component");
});

it("documents request bodies as required when an input schema exists unless overridden", () => {
	const operation = (router: Router) =>
		generate(router).paths["/users"]!.post as {
			requestBody?: { required: boolean; content: Record<string, { schema: Record<string, unknown> }> };
		};
	const required = client
		.inputSchema(z.object({ name: z.string() }))
		.outputSchema(z.string())
		.action(async () => "ok");
	expect(operation(createRouter().post("/users", required, { openapi })).requestBody!.required).toBe(true);
	const optional = client
		.inputSchema(z.string().optional())
		.outputSchema(z.string())
		.action(async () => "ok");
	const optionalRouter = createRouter().post("/users", optional, {
		openapi: { operationId: "createUser", requestBodyRequired: false },
	});
	expect(operation(optionalRouter).requestBody!.required).toBe(false);
	const none = client.outputSchema(z.string()).action(async () => "ok");
	expect(operation(createRouter().post("/users", none, { openapi })).requestBody).toBeUndefined();
	const state = client
		.inputSchema(z.number())
		.outputSchema(z.number())
		.stateAction(async () => 1);
	const envelope = operation(createRouter().post("/users", state, { stateSchema: z.object({}), openapi })).requestBody!;
	expect(envelope.required).toBe(true);
	expect(envelope.content["application/json"]!.schema.required).toEqual(["input"]);
	const looseState = client.outputSchema(z.number()).stateAction(async () => 1);
	const loose = operation(
		createRouter().post("/users", looseState, { stateSchema: z.object({}), openapi })
	).requestBody!;
	expect(loose.required).toBe(true);
	expect(loose.content["application/json"]!.schema.required).toBeUndefined();
});

it("keeps document references and instance data, and rewrites local references in schema maps", () => {
	const a = client.outputSchema(z.string()).action(async () => "ok");
	const ref = { $ref: "#/components/schemas/createUser_Output" };
	const schemasOf = (config: RouteOpenApi, options: Partial<OpenApiDocumentOptions> = {}) =>
		generate(createRouter().post("/users", a, { openapi: config }), options).components.schemas;
	expect(schemasOf({ operationId: "createUser", requestBodySchema: ref }).createUser_Request).toEqual(ref);
	const nested = { type: "object", properties: { nested: ref } };
	expect(schemasOf({ operationId: "createUser", outputSchema: nested }).createUser_Output).toEqual(nested);
	expect(schemasOf({ operationId: "createUser", serverErrorSchema: ref }).createUser_ServerError).toEqual(ref);
	const defaults = { validationErrorsSchema: ref };
	expect(schemasOf({ operationId: "createUser" }, defaults).createUser_ValidationErrors).toEqual(ref);
	// An explicit undefined falls back to the document defaults.
	expect(
		schemasOf({ operationId: "createUser", serverErrorSchema: undefined }, defaults).createUser_ServerError
	).toEqual(errors.serverErrorSchema);
	// Schema-map entries are schemas whatever their name, and $dynamicRef follows the same rules as $ref.
	const request = schemasOf({
		operationId: "createUser",
		requestBodySchema: {
			type: "object",
			properties: { default: { $ref: "#" }, self: { $dynamicRef: "#/properties/default" } },
			$defs: { const: ref },
		},
	});
	expect(request.createUser_Request).toEqual({
		type: "object",
		properties: {
			default: { $ref: "#/components/schemas/createUser_Request" },
			self: { $dynamicRef: "#/components/schemas/createUser_Request/properties/default" },
		},
	});
	expect(request.createUser_Request_const).toEqual(ref);
	// Instance data that merely looks like a reference, and non-fragment references, are never rewritten.
	const data = { $ref: "#/$defs/x" };
	const local = schemasOf({
		operationId: "createUser",
		requestBodySchema: {
			$ref: "#/$defs/x/properties/a",
			$defs: {
				x: { type: "object", examples: [data], default: data, const: data, enum: [data], example: data },
			},
			not: { $ref: "%23/components/schemas/X" },
		},
	});
	expect(local.createUser_Request).toEqual({
		$ref: "#/components/schemas/createUser_Request_x/properties/a",
		not: { $ref: "%23/components/schemas/X" },
	});
	expect(local.createUser_Request_x).toEqual({
		type: "object",
		examples: [data],
		default: data,
		const: data,
		enum: [data],
		example: data,
	});
});

it("validates parameter overrides against the template", () => {
	const a = client.outputSchema(z.string()).action(async () => "ok");
	const at = (path: string, parameters: unknown) =>
		generate(
			createRouter().post(path, a, {
				mapInput: passInput,
				openapi: { operationId: "p", requestBodySchema: true, parameters: parameters as never },
			})
		);
	const id = { name: "id", in: "path", required: true, schema: { type: "string" } };
	expect(() => at("/users/{id}", [id, id])).toThrow("duplicate parameter");
	expect(() => at("/users", [id])).toThrow("not in the template");
	expect(() => at("/users/{id}", [{ ...id, schema: undefined }])).toThrow("requires schema");
	expect(() => at("/users/{id}", [{ ...id, in: "body" }])).toThrow("invalid parameter");
	const query = { name: "locale", in: "query", schema: { type: "string" } };
	const doc = at("/users/{id}", [id, query]);
	expect((doc.paths["/users/{id}"]!.post as { parameters: unknown[] }).parameters).toEqual([id, query]);
});

it("keeps every error alternative when server errors map to 400", () => {
	const a = client.outputSchema(z.string()).action(async () => "ok");
	const document = generate(
		createRouter().post("/users", a, {
			serverErrorStatus: () => 400,
			openapi: { operationId: "createUser", serverErrorStatuses: [400] },
		})
	);
	const { responses } = document.paths["/users"]!.post as {
		responses: Record<string, { content: Record<string, { schema: { anyOf: unknown[] } }> }>;
	};
	expect(responses["400"]!.content["application/json"]!.schema.anyOf).toHaveLength(3);
	// Registered methods never produce 405, so operations do not document it.
	expect(new Set(Object.keys(responses))).toEqual(
		new Set(["200", "303", "400", "401", "403", "404", "413", "415", "500"])
	);
	// Sanitized adapter failures can always produce a 500 httpError.
	expect(responses["500"]!.content["application/json"]!.schema).toEqual({ $ref: "#/components/schemas/HttpError" });
});

it("emits only document-resolvable references for recursive zod schemas with identified subschemas", () => {
	const Tag = z.object({ name: z.string() }).meta({ id: "Tag" });
	const Category = z.object({
		name: z.string(),
		tags: z.array(Tag),
		get children() {
			return z.array(Category);
		},
	});
	const a = client
		.inputSchema(Category)
		.outputSchema(Category)
		.action(async ({ parsedInput }) => parsedInput);
	const document = generate(createRouter().post("/users", a, { openapi }));
	const refs: string[] = [];
	const collect = (node: unknown): void => {
		if (!node || typeof node !== "object") return;
		for (const [key, value] of Object.entries(node)) {
			if (key === "$ref" && typeof value === "string") refs.push(value);
			else collect(value);
		}
	};
	collect(document);
	const resolve = (ref: string) =>
		ref
			.slice(2)
			.split("/")
			.map((token) => decodeURIComponent(token).replaceAll("~1", "/").replaceAll("~0", "~"))
			.reduce<unknown>((node, token) => (node as Record<string, unknown> | undefined)?.[token], document);
	expect(refs).toContain("#/components/schemas/createUser_Input");
	expect(refs).toContain("#/components/schemas/createUser_Input_Tag");
	for (const ref of refs) {
		expect(ref.startsWith("#/")).toBe(true);
		expect(resolve(ref), ref).toBeDefined();
	}
	const components = JSON.stringify(document.components);
	expect(components).not.toContain('"$id"');
	expect(components).not.toContain('"$defs"');
});
