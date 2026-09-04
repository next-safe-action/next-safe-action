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

it("generates opt-in operations without executing actions or callbacks", () => {
	const execution = vi.fn(async () => "value");
	const mapping = vi.fn(({ input }) => input);
	const a = client.metadata({ endpoint }).inputSchema(z.string()).outputSchema(z.string()).action(execution);
	const hidden = client.metadata({ endpoint: { method: "PUT", path: "/users" } }).action(execution);
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
	expect(factory).not.toHaveBeenCalled();
	const transformed = client
		.metadata({ endpoint })
		.outputSchema(z.string().transform(Number))
		.action(async () => 1);
	expect(() => generateOpenApiDocument({ actions: [transformed], info })).toThrow("createUser_Output");
});
it("keeps recursive roots, definitions, nullable and boolean schemas intact", () => {
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
	expect(schemas.recursive_Request).toEqual({
		...recursive,
		$id: "https://next-safe-action.invalid/schemas/recursive_Request",
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

it("preserves converted recursive schema references in their own resource", () => {
	const node: z.ZodType<{ children: unknown[] }> = z.object({ children: z.array(z.lazy(() => node)) });
	const a = client
		.metadata({ endpoint })
		.inputSchema(node)
		.outputSchema(node)
		.action(async ({ parsedInput }) => parsedInput);
	const schemas = generateOpenApiDocument({ actions: [a], info }).components.schemas;
	const input = schemas.createUser_Input as Record<string, unknown>;
	const output = schemas.createUser_Output as Record<string, unknown>;
	expect(JSON.stringify(input)).toContain('"$ref":"#"');
	expect(input.$id).not.toBe(output.$id);
});

it("reports missing status and parameter contracts and duplicate schema resources", () => {
	const base = client.outputSchema(z.string());
	const status = base.metadata({ endpoint: { ...endpoint, serverErrorStatus: () => 409 } }).action(async () => "ok");
	expect(() => generateOpenApiDocument({ actions: [status], info })).toThrow("serverErrorStatuses");
	const parameter = base
		.metadata({ endpoint: { ...endpoint, path: "/users/{id}", openapi: { operationId: "parameter", parameters: [] } } })
		.action(async () => "ok");
	expect(() => generateOpenApiDocument({ actions: [parameter], info })).toThrow("path parameter");
	const duplicate = base
		.metadata({
			endpoint: {
				...endpoint,
				openapi: {
					operationId: "duplicate",
					requestBodySchema: { $id: "https://example.test/shared" },
					outputSchema: { $id: "https://example.test/shared" },
				},
			},
		})
		.action(async () => "ok");
	expect(() => generateOpenApiDocument({ actions: [duplicate], info })).toThrow("duplicate schema resource");
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

it("rejects document-relative references inside overrides and defaults", () => {
	const base = client.outputSchema(z.string());
	const ref = { $ref: "#/components/schemas/createUser_Output" };
	for (const openapi of [
		{ operationId: "createUser", requestBodySchema: ref },
		{ operationId: "createUser", outputSchema: { type: "object", properties: { nested: ref } } },
		{ operationId: "createUser", serverErrorSchema: ref },
	]) {
		const a = base.metadata({ endpoint: { ...endpoint, openapi } }).action(async () => "ok");
		expect(() => generateOpenApiDocument({ actions: [a], info })).toThrow("document-relative");
	}
	const encoded = base
		.metadata({
			endpoint: {
				...endpoint,
				openapi: { operationId: "createUser", requestBodySchema: { $ref: "#/%63omponents/schemas/X" } },
			},
		})
		.action(async () => "ok");
	expect(() => generateOpenApiDocument({ actions: [encoded], info })).toThrow("document-relative");
	const defaults = createSafeActionClient({
		defineMetadataSchema: () => z.object({ endpoint: z.custom<EndpointMetadata>() }),
	})
		.use(routesMiddleware({ openapiDefaults: { ...errors, validationErrorsSchema: ref } }))
		.metadata({ endpoint })
		.outputSchema(z.string())
		.action(async () => "ok");
	expect(() => generateOpenApiDocument({ actions: [defaults], info })).toThrow("createUser_ValidationErrors");
	// Schema maps are inspected whatever the entry name, and $dynamicRef follows the same rules as $ref.
	for (const requestBodySchema of [
		{ type: "object", properties: { default: ref } },
		{ $defs: { const: ref }, type: "object" },
		{ $dynamicRef: "#/components/schemas/createUser_Output" },
		{ $dynamicRef: "#/%63omponents/schemas/createUser_Output" },
	]) {
		const a = base
			.metadata({ endpoint: { ...endpoint, openapi: { operationId: "createUser", requestBodySchema } } })
			.action(async () => "ok");
		expect(() => generateOpenApiDocument({ actions: [a], info })).toThrow("document-relative");
	}
	// A percent-encoded "#" belongs to a resource path, not to a fragment.
	const resourcePath = base
		.metadata({
			endpoint: {
				...endpoint,
				openapi: { operationId: "createUser", requestBodySchema: { $ref: "%23/components/schemas/X" } },
			},
		})
		.action(async () => "ok");
	expect(() => generateOpenApiDocument({ actions: [resourcePath], info })).not.toThrow();
	// Local references and instance data that merely looks like a reference stay valid.
	const local = base
		.metadata({
			endpoint: {
				...endpoint,
				openapi: {
					operationId: "createUser",
					requestBodySchema: {
						$ref: "#/$defs/x",
						$defs: { x: { type: "object", examples: [ref], default: ref, const: ref, enum: [ref] } },
					},
				},
			},
		})
		.action(async () => "ok");
	expect(() => generateOpenApiDocument({ actions: [local], info })).not.toThrow();
});

it("validates parameter overrides against the template", () => {
	const base = client.outputSchema(z.string());
	const at = (path: string, parameters: unknown) =>
		base
			.metadata({
				endpoint: { ...endpoint, path, openapi: { operationId: "p", parameters: parameters as never } },
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
	// Sanitized adapter failures can always produce a 500 httpError.
	expect(responses["500"]!.content["application/json"]!.schema).toEqual({ $ref: "#/components/schemas/HttpError" });
});
