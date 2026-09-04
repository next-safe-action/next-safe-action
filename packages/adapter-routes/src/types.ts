import type { ActionDefinition } from "next-safe-action";

export type Schema = NonNullable<ActionDefinition["inputSchema"]>;
export type JsonSchema = boolean | Record<string, unknown>;
export type MutationMethod = "POST" | "PUT" | "PATCH" | "DELETE";
export type OpenApiErrors = {
	serverErrorSchema?: JsonSchema;
	validationErrorsSchema?: JsonSchema;
};
export type EndpointOpenApi = OpenApiErrors & {
	operationId: string;
	summary?: string;
	description?: string;
	tags?: string[];
	requestBodySchema?: JsonSchema;
	outputSchema?: JsonSchema;
	prevResultSchema?: JsonSchema;
	parameters?: Record<string, unknown>[];
	serverErrorStatuses?: number[];
};
export type EndpointMetadata = {
	method: MutationMethod;
	path: string;
	mapInput?: (args: { input: unknown; params: Readonly<Record<string, string>>; request: Request }) => unknown;
	stateSchema?: Schema;
	successStatus?: number;
	headers?: HeadersInit;
	serverErrorStatus?: (error: unknown) => number;
	openapi?: EndpointOpenApi;
};
export type RoutesMiddlewareOptions = {
	requireEndpoint?: boolean;
	openapi?: "opt-in" | "required";
	openapiDefaults?: OpenApiErrors;
};
export type RoutesOptions = {
	actions: readonly ((...args: any[]) => Promise<any>)[];
	pathParam?: string;
	maxBodyBytes?: number;
	allowedOrigins?: readonly string[];
	credentials?: boolean;
	allowedHeaders?: readonly string[];
};
export type RouteContext = { params: Promise<Record<string, string | string[] | undefined>> };
export type HttpError = { httpError: { code: string; message: string } };
