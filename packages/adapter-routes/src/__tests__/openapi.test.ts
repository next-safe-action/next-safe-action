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
