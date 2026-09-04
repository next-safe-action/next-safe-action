import type { ActionDefinition } from "next-safe-action";

export type Schema = NonNullable<ActionDefinition["inputSchema"]>;
export type JsonSchema = boolean | Record<string, unknown>;
export type MutationMethod = "POST" | "PUT" | "PATCH" | "DELETE";
export type OpenApiErrors = {
	serverErrorSchema?: JsonSchema;
	validationErrorsSchema?: JsonSchema;
};
export type OpenApiParameter = {
	name: string;
	in: "path" | "query" | "header" | "cookie";
	required?: boolean;
	description?: string;
	schema: JsonSchema;
	deprecated?: boolean;
};
export type EndpointOpenApi = OpenApiErrors & {
	operationId: string;
	summary?: string;
	description?: string;
	tags?: string[];
	requestBodySchema?: JsonSchema;
	/** Defaults to true when the action has an input schema or `requestBodySchema` is set. */
	requestBodyRequired?: boolean;
	outputSchema?: JsonSchema;
	prevResultSchema?: JsonSchema;
	parameters?: OpenApiParameter[];
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
	/** Receives the original error behind every sanitized 500 response. The response stays sanitized and is not delayed. */
	onError?: (error: unknown, context: { request: Request }) => void | Promise<void>;
};
export type RouteContext = { params: Promise<Record<string, string | string[] | undefined>> };
export type HttpError = { httpError: { code: string; message: string } };
