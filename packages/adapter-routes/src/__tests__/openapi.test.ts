import { createSafeActionClient } from "next-safe-action";
import { expect, it, vi } from "vitest";
import { z } from "zod";
import { routesMiddleware } from "../index";
import { generateOpenApiDocument } from "../openapi";
import type { EndpointMetadata } from "../types";

const errors = { serverErrorSchema: { type: "string" }, validationErrorsSchema: { type: "object" } };
const client = createSafeActionClient({
	defineMetadataSchema: () => z.object({ endpoint: z.custom<EndpointMetadata>() }),
}).use(routesMiddleware({ openapiDefaults: errors }));
const info = { title: "Example", version: "1" };
const endpoint: EndpointMetadata = { method: "POST", path: "/users", openapi: { operationId: "createUser" } };
const mapInput: EndpointMetadata["mapInput"] = ({ input }) => input;

it("generates opt-in operations without executing actions or callbacks", () => {
	const execution = vi.fn(async () => "value");
	const mapping = vi.fn(({ input }) => input);
	const a = client.metadata({ endpoint }).inputSchema(z.string()).outputSchema(z.string()).action(execution);
	const hidden = client.metadata({ endpoint: { method: "PUT", path: "/users" } }).action(execution);
	const unrouted = createSafeActionClient().action(execution);
	expect(() => generateOpenApiDocument({ actions: [unrouted], info })).toThrow("has no route");
	const mapped = client
		.metadata({
			endpoint: {
				...endpoint,
				path: "/mapped",
				mapInput: mapping,
				openapi: { operationId: "mapped", requestBodySchema: false, parameters: [] },
			},
		})
		.outputSchema(z.string())
		.action(execution);
	const document = generateOpenApiDocument({ actions: [a, hidden, mapped], info });
	expect(document.openapi).toBe("3.1.1");
	expect(Object.keys(document.paths["/users"]!)).toEqual(["post"]);
	expect(document.components.schemas.mapped_Request).toBe(false);
	expect(execution).not.toHaveBeenCalled();
	expect(mapping).not.toHaveBeenCalled();
});
it("requires explicit errors, output, mapping contracts and required opt-in", () => {
	const required = createSafeActionClient({
		defineMetadataSchema: () => z.object({ endpoint: z.custom<EndpointMetadata>() }),
	}).use(routesMiddleware({ openapi: "required" }));
	expect(() => required.metadata({ endpoint: { method: "POST", path: "/users" } }).action(async () => {})).toThrow(
		"OpenAPI"
	);
	const noOutput = client.metadata({ endpoint }).action(async () => {});
	expect(() => generateOpenApiDocument({ actions: [noOutput], info })).toThrow("createUser_Output");
	const mapped = client
		.metadata({ endpoint: { ...endpoint, mapInput: ({ input }) => input } })
		.outputSchema(z.string())
		.action(async () => "ok");
	expect(() => generateOpenApiDocument({ actions: [mapped], info })).toThrow("mapInput");
	const noErrors = required
		.metadata({ endpoint })
		.outputSchema(z.string())
		.action(async () => "ok");
	expect(() => generateOpenApiDocument({ actions: [noErrors], info })).toThrow("serverErrorSchema");
});
it("does not execute dynamic factories and identifies missing schemas", () => {
	const factory = vi.fn(async () => z.string());
	const a = client
		.metadata({ endpoint })
		.inputSchema(factory)
		.outputSchema(z.string())
		.action(async () => "ok");
	expect(() => generateOpenApiDocument({ actions: [a], info })).toThrow("dynamic input");
	const documented = client
		.metadata({
			endpoint: { ...endpoint, openapi: { operationId: "createUser", requestBodySchema: { type: "string" } } },
		})
		.inputSchema(factory)
		.outputSchema(z.string())
		.action(async () => "ok");
	const schemas = generateOpenApiDocument({ actions: [documented], info }).components.schemas;
	expect(schemas.createUser_Request).toEqual({ type: "string" });
	expect(factory).not.toHaveBeenCalled();
	const transformed = client
		.metadata({ endpoint })
		.outputSchema(z.string().transform(Number))
		.action(async () => 1);
	expect(() => generateOpenApiDocument({ actions: [transformed], info })).toThrow("createUser_Output");
});
it("flattens recursive roots and definitions into components and keeps nullable and boolean schemas", () => {
	const recursive = {
		$defs: { node: { type: ["object", "null"], properties: { child: { $ref: "#/$defs/node" }, root: { $ref: "#" } } } },
		$ref: "#/$defs/node",
	};
	const a = client
		.metadata({
			endpoint: {
				...endpoint,
				openapi: { operationId: "recursive", requestBodySchema: recursive, outputSchema: true },
			},
		})
		.action(async () => {});
	const schemas = generateOpenApiDocument({ actions: [a], info }).components.schemas;
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
		.metadata({
			endpoint: {
				...endpoint,
				stateSchema: z.object({ data: z.number() }),
				serverErrorStatus: () => 409,
				openapi: { operationId: "state", serverErrorStatuses: [409] },
			},
		})
		.inputSchema(z.number())
		.outputSchema(z.number())
		.stateAction(async () => 1);
	const doc = generateOpenApiDocument({ actions: [a], info });
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
		.metadata({ endpoint: { ...endpoint, stateSchema: schema } })
		.inputSchema(schema)
		.outputSchema(schema)
		.stateAction(async () => 1);
	generateOpenApiDocument({ actions: [a], info });
	expect(input).toHaveBeenCalledTimes(2);
	expect(input).toHaveBeenCalledWith({ target: "draft-2020-12" });
	expect(output).toHaveBeenCalledExactlyOnceWith({ target: "draft-2020-12" });
	expect(validate).not.toHaveBeenCalled();
});

it("rewrites converted recursive root references to their own component", () => {
	const node: z.ZodType<{ children: unknown[] }> = z.object({ children: z.array(z.lazy(() => node)) });
	const a = client
		.metadata({ endpoint })
		.inputSchema(node)
		.outputSchema(node)
		.action(async ({ parsedInput }) => parsedInput);
	const schemas = generateOpenApiDocument({ actions: [a], info }).components.schemas;
	const input = schemas.createUser_Input as Record<string, unknown>;
	const output = schemas.createUser_Output as Record<string, unknown>;
	expect(JSON.stringify(input)).toContain('"$ref":"#/components/schemas/createUser_Input"');
	expect(JSON.stringify(output)).toContain('"$ref":"#/components/schemas/createUser_Output"');
	expect(input).not.toHaveProperty("$schema");
});

it("reports missing status and parameter contracts and duplicate schema components", () => {
	const base = client.outputSchema(z.string());
	const status = base.metadata({ endpoint: { ...endpoint, serverErrorStatus: () => 409 } }).action(async () => "ok");
	expect(() => generateOpenApiDocument({ actions: [status], info })).toThrow("serverErrorStatuses");
	const parameter = base
		.metadata({
			endpoint: {
				...endpoint,
				path: "/users/{id}",
				mapInput,
				openapi: { operationId: "parameter", requestBodySchema: true, parameters: [] },
			},
		})
		.action(async () => "ok");
	expect(() => generateOpenApiDocument({ actions: [parameter], info })).toThrow("missing required path parameter");
	// Identical $id values no longer collide: $id is dropped when a schema is flattened into components.
	const sharedId = base
		.metadata({
			endpoint: {
				...endpoint,
				openapi: {
					operationId: "shared",
					requestBodySchema: { $id: "https://example.test/shared", $schema: "x" },
					outputSchema: { $id: "https://example.test/shared" },
				},
			},
		})
		.action(async () => "ok");
	expect(generateOpenApiDocument({ actions: [sharedId], info }).components.schemas.shared_Request).toEqual({});
	// "$defs" keys are sanitized into component names, so distinct keys can still collide.
	const sanitized = base
		.metadata({
			endpoint: { ...endpoint, openapi: { operationId: "a", requestBodySchema: { $defs: { "x y": {}, "x_y": {} } } } },
		})
		.action(async () => "ok");
	expect(() => generateOpenApiDocument({ actions: [sanitized], info })).toThrow(
		"a_Request_x_y: duplicate schema component"
	);
	const owner = base
		.metadata({
			endpoint: { ...endpoint, openapi: { operationId: "x", outputSchema: { $defs: { ServerError: {} } } } },
		})
		.action(async () => "ok");
	const other = base
		.metadata({ endpoint: { ...endpoint, path: "/other", openapi: { operationId: "x_Output" } } })
		.action(async () => "ok");
	expect(() => generateOpenApiDocument({ actions: [owner, other], info })).toThrow("duplicate schema component");
});

it("documents request bodies as required when an input schema exists unless overridden", () => {
	const operation = (a: Parameters<typeof generateOpenApiDocument>[0]["actions"][number]) =>
		generateOpenApiDocument({ actions: [a], info }).paths["/users"]!.post as {
			requestBody?: { required: boolean; content: Record<string, { schema: Record<string, unknown> }> };
		};
	const required = client
		.metadata({ endpoint })
		.inputSchema(z.object({ name: z.string() }))
		.outputSchema(z.string())
		.action(async () => "ok");
	expect(operation(required).requestBody!.required).toBe(true);
	const optional = client
		.metadata({ endpoint: { ...endpoint, openapi: { operationId: "createUser", requestBodyRequired: false } } })
		.inputSchema(z.string().optional())
		.outputSchema(z.string())
		.action(async () => "ok");
	expect(operation(optional).requestBody!.required).toBe(false);
	const none = client
		.metadata({ endpoint })
		.outputSchema(z.string())
		.action(async () => "ok");
	expect(operation(none).requestBody).toBeUndefined();
	const state = client
		.metadata({ endpoint: { ...endpoint, stateSchema: z.object({}) } })
		.inputSchema(z.number())
		.outputSchema(z.number())
		.stateAction(async () => 1);
	const envelope = operation(state).requestBody!;
	expect(envelope.required).toBe(true);
	expect(envelope.content["application/json"]!.schema.required).toEqual(["input"]);
	const looseState = client
		.metadata({ endpoint: { ...endpoint, stateSchema: z.object({}) } })
		.outputSchema(z.number())
		.stateAction(async () => 1);
	const loose = operation(looseState).requestBody!;
	expect(loose.required).toBe(true);
	expect(loose.content["application/json"]!.schema.required).toBeUndefined();
});

it("keeps document references and instance data, and rewrites local references in schema maps", () => {
	const base = client.outputSchema(z.string());
	const ref = { $ref: "#/components/schemas/createUser_Output" };
	const schemasOf = (openapi: EndpointMetadata["openapi"], a = base) =>
		generateOpenApiDocument({
			actions: [a.metadata({ endpoint: { ...endpoint, openapi } }).action(async () => "ok")],
			info,
		}).components.schemas;
	expect(schemasOf({ operationId: "createUser", requestBodySchema: ref }).createUser_Request).toEqual(ref);
	const nested = { type: "object", properties: { nested: ref } };
	expect(schemasOf({ operationId: "createUser", outputSchema: nested }).createUser_Output).toEqual(nested);
	expect(schemasOf({ operationId: "createUser", serverErrorSchema: ref }).createUser_ServerError).toEqual(ref);
	const defaults = createSafeActionClient({
		defineMetadataSchema: () => z.object({ endpoint: z.custom<EndpointMetadata>() }),
	})
		.use(routesMiddleware({ openapiDefaults: { ...errors, validationErrorsSchema: ref } }))
		.outputSchema(z.string());
	const fromDefaults = schemasOf({ operationId: "createUser" }, defaults);
	expect(fromDefaults.createUser_ValidationErrors).toEqual(ref);
	// An explicit undefined falls back to the middleware defaults.
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
	const base = client.outputSchema(z.string());
	const at = (path: string, parameters: unknown) =>
		base
			.metadata({
				endpoint: {
					...endpoint,
					path,
					mapInput,
					openapi: { operationId: "p", requestBodySchema: true, parameters: parameters as never },
				},
			})
			.action(async () => "ok");
	const id = { name: "id", in: "path", required: true, schema: { type: "string" } };
	expect(() => generateOpenApiDocument({ actions: [at("/users/{id}", [id, id])], info })).toThrow(
		"duplicate parameter"
	);
	expect(() => generateOpenApiDocument({ actions: [at("/users", [id])], info })).toThrow("not in the template");
	expect(() => generateOpenApiDocument({ actions: [at("/users/{id}", [{ ...id, schema: undefined }])], info })).toThrow(
		"requires schema"
	);
	expect(() => generateOpenApiDocument({ actions: [at("/users/{id}", [{ ...id, in: "body" }])], info })).toThrow(
		"invalid parameter"
	);
	const query = { name: "locale", in: "query", schema: { type: "string" } };
	const doc = generateOpenApiDocument({ actions: [at("/users/{id}", [id, query])], info });
	expect((doc.paths["/users/{id}"]!.post as { parameters: unknown[] }).parameters).toEqual([id, query]);
});

it("keeps every error alternative when server errors map to 400", () => {
	const a = client
		.metadata({
			endpoint: {
				...endpoint,
				serverErrorStatus: () => 400,
				openapi: { operationId: "createUser", serverErrorStatuses: [400] },
			},
		})
		.outputSchema(z.string())
		.action(async () => "ok");
	const responses = (
		generateOpenApiDocument({ actions: [a], info }).paths["/users"]!.post as {
			responses: Record<string, { content: Record<string, { schema: { anyOf: unknown[] } }> }>;
		}
	).responses;
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
		.metadata({ endpoint })
		.inputSchema(Category)
		.outputSchema(Category)
		.action(async ({ parsedInput }) => parsedInput);
	const document = generateOpenApiDocument({ actions: [a], info });
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
