import { isParameter, routeTable } from "./definition";
import type { JsonSchema, RoutesOptions, Schema } from "./types";

export type OpenApiDocumentOptions = Pick<RoutesOptions, "actions"> & {
	info: { title: string; version: string; description?: string };
	servers?: { url: string; description?: string }[];
};

function envelope(key: string, schema: JsonSchema): JsonSchema {
	return { type: "object", required: [key], additionalProperties: false, properties: { [key]: schema } };
}
function response(description: string, schema: JsonSchema) {
	return { description, content: { "application/json": { schema } } };
}

export function generateOpenApiDocument(options: OpenApiDocumentOptions) {
	const schemas: Record<string, JsonSchema> = {};
	const paths: Record<string, Record<string, unknown>> = {};
	const operationIds = new Set<string>();
	const resourceIds = new Set<string>();
	function component(name: string, schema: JsonSchema): JsonSchema {
		if (typeof schema !== "boolean" && (!schema || typeof schema !== "object" || Array.isArray(schema)))
			throw new TypeError(name + ": invalid JSON Schema");
		if (typeof schema === "boolean") schemas[name] = schema;
		else {
			const base = "https://next-safe-action.invalid/schemas/" + name;
			const id = typeof schema.$id === "string" ? new URL(schema.$id, base).href : base;
			if (resourceIds.has(id)) throw new TypeError(name + ": duplicate schema resource identifier");
			resourceIds.add(id);
			// Each schema remains a complete resource. Local refs and $defs retain their root.
			schemas[name] = { ...schema, $id: id };
		}
		return { $ref: "#/components/schemas/" + name };
	}
	const httpError = component("HttpError", {
		type: "object",
		required: ["httpError"],
		additionalProperties: false,
		properties: {
			httpError: {
				type: "object",
				required: ["code", "message"],
				additionalProperties: false,
				properties: { code: { type: "string" }, message: { type: "string" } },
			},
		},
	});
	function convert(
		name: string,
		schema: Schema | undefined,
		side: "input" | "output",
		override?: JsonSchema
	): JsonSchema {
		if (override !== undefined) return component(name, override);
		const standard:
			| (Schema["~standard"] & {
					jsonSchema?: Record<"input" | "output", (options: { target: string }) => Record<string, unknown>>;
			  })
			| undefined = schema?.["~standard"];
		if (!standard?.jsonSchema) throw new TypeError(name + ": missing JSON Schema; provide an explicit override");
		try {
			return component(name, standard.jsonSchema[side]({ target: "draft-2020-12" }));
		} catch (cause) {
			throw new TypeError(name + ": JSON Schema conversion failed; provide an explicit override", { cause });
		}
	}
	for (const route of routeTable(options.actions)) {
		const { endpoint, definition } = route;
		const config = endpoint.openapi;
		if (!config) continue;
		const id = config.operationId;
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id) || operationIds.has(id) || id === "HttpError")
			throw new TypeError("Invalid or duplicate operationId: " + id);
		operationIds.add(id);
		if (definition.dynamicInputSchema) throw new TypeError(id + ": dynamic input schemas cannot be documented");
		if (endpoint.mapInput && (config.requestBodySchema === undefined || config.parameters === undefined))
			throw new TypeError(id + ": mapInput requires requestBodySchema and parameters");
		const errors = { ...route.defaults, ...config };
		if (errors.serverErrorSchema === undefined || errors.validationErrorsSchema === undefined)
			throw new TypeError(id + ": explicit serverErrorSchema and validationErrorsSchema are required");
		const output = convert(id + "_Output", definition.outputSchema, "output", config.outputSchema);
		const serverError = component(id + "_ServerError", errors.serverErrorSchema);
		const validation = component(id + "_ValidationErrors", errors.validationErrorsSchema);
		let request: JsonSchema | undefined;
		if (config.requestBodySchema !== undefined) request = component(id + "_Request", config.requestBodySchema);
		else if (definition.inputSchema) request = convert(id + "_Input", definition.inputSchema, "input");
		if (definition.stateful) {
			const previous = convert(id + "_PrevResult", endpoint.stateSchema, "input", config.prevResultSchema);
			// An override describes the complete HTTP envelope, not just its input field.
			if (config.requestBodySchema === undefined)
				request = {
					type: "object",
					additionalProperties: false,
					properties: { input: request ?? true, prevResult: previous },
				};
		}
		const parameters: Record<string, unknown>[] =
			config.parameters ??
			route.segments
				.filter(isParameter)
				.map((part) => ({ name: part.slice(1, -1), in: "path", required: true, schema: { type: "string" } }));
		for (const part of route.segments.filter(isParameter)) {
			if (!parameters.some((p) => p.in === "path" && p.name === part.slice(1, -1) && p.required === true))
				throw new TypeError(id + ": missing required path parameter " + part);
		}
		const responses: Record<string, ReturnType<typeof response> | Record<string, unknown>> = {};
		responses[endpoint.successStatus ?? 200] = response(
			"Action result, including void success or middleware short-circuit",
			{ anyOf: [envelope("data", output), { type: "object", maxProperties: 0 }] }
		);
		for (const status of [400, 401, 403, 404, 405, 413, 415, 500])
			responses[status] = response("HTTP error", httpError);
		responses[400] = response("Validation or HTTP error", {
			anyOf: [envelope("validationErrors", validation), httpError],
		});
		if (endpoint.serverErrorStatus && !config.serverErrorStatuses?.length)
			throw new TypeError(id + ": serverErrorStatuses is required for status mapping");
		for (const status of endpoint.serverErrorStatus ? config.serverErrorStatuses! : [500]) {
			if (!Number.isInteger(status) || status < 400 || status > 599)
				throw new TypeError(id + ": invalid server error status");
			responses[status] = response("Action or HTTP error", {
				anyOf: [
					envelope("serverError", serverError),
					httpError,
					...(status === 400 ? [envelope("validationErrors", validation)] : []),
				],
			});
		}
		responses[303] = { description: "Mutation redirect", headers: { Location: { schema: { type: "string" } } } };
		paths[endpoint.path] ??= {};
		paths[endpoint.path]![endpoint.method.toLowerCase()] = {
			operationId: id,
			...(config.summary ? { summary: config.summary } : {}),
			...(config.description ? { description: config.description } : {}),
			...(config.tags ? { tags: config.tags } : {}),
			parameters,
			responses,
			...(request !== undefined
				? { requestBody: { required: definition.stateful, content: { "application/json": { schema: request } } } }
				: {}),
		};
	}
	return {
		openapi: "3.1.1",
		info: options.info,
		...(options.servers ? { servers: options.servers } : {}),
		paths,
		components: { schemas },
	};
}
