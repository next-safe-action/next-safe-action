import type { ActionDefinition, InferSafeActionFnInput, InferServerError } from "next-safe-action";

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
export type RouteOpenApi = OpenApiErrors & {
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

export type RouteAction = (...args: any[]) => Promise<any>;
/** Names of the `{param}` segments of a path template. */
export type PathParamNames<Path extends string> = Path extends `${string}{${infer Name}}${infer Rest}`
	? Name | PathParamNames<Rest>
	: never;
// Stateful actions take `(prevResult, input)`; the input may be optional, so the length can be `1 | 2`.
type IsStateful<Action extends RouteAction> = 2 extends Parameters<Action>["length"] ? true : false;
type ActionInput<Action extends RouteAction> = InferSafeActionFnInput<Action>["clientInput"];

export type MapInput<Action extends RouteAction, Path extends string> = (args: {
	input: unknown;
	params: Readonly<Record<PathParamNames<Path>, string>>;
	request: Request;
}) => ActionInput<Action> | Promise<ActionInput<Action>>;

/**
 * Per-route HTTP configuration. `mapInput` is required when the path has parameters, and `stateSchema` is required
 * for stateful actions.
 */
export type RouteConfig<Action extends RouteAction, Path extends string> = {
	successStatus?: number;
	headers?: HeadersInit;
	serverErrorStatus?: (error: InferServerError<Action>) => number;
	openapi?: RouteOpenApi;
} & ([PathParamNames<Path>] extends [never]
	? { mapInput?: MapInput<Action, Path> }
	: { mapInput: MapInput<Action, Path> }) &
	(IsStateful<Action> extends true ? { stateSchema: Schema } : { stateSchema?: never });

type RouteConfigArgs<Action extends RouteAction, Path extends string> =
	{} extends RouteConfig<Action, Path> ? [config?: RouteConfig<Action, Path>] : [config: RouteConfig<Action, Path>];
type AddRoute = <Path extends string, Action extends RouteAction>(
	path: Path,
	action: Action,
	...config: RouteConfigArgs<Action, Path>
) => Router;

/** A compiled route, as stored by the router. */
export type Route = Readonly<{
	method: MutationMethod;
	path: string;
	segments: readonly string[];
	action: RouteAction;
	definition: ActionDefinition;
	config: Readonly<{
		mapInput?: (args: { input: unknown; params: Readonly<Record<string, string>>; request: Request }) => unknown;
		stateSchema?: Schema;
		successStatus?: number;
		headers?: [string, string][];
		serverErrorStatus?: (error: unknown) => number;
		openapi?: RouteOpenApi;
	}>;
}>;

/** An immutable route table. Each method returns a new router with the route added. */
export type Router = Readonly<{
	routes: readonly Route[];
	post: AddRoute;
	put: AddRoute;
	patch: AddRoute;
	delete: AddRoute;
}>;

export type RouteHandlersOptions = {
	pathParam?: string;
	maxBodyBytes?: number;
	/** Other origins that the origin check accepts. The adapter sends no CORS headers. */
	allowedOrigins?: readonly string[];
	/** Receives the original error behind every sanitized 500 response. The response stays sanitized and is not delayed. */
	onError?: (error: unknown, context: { request: Request }) => void | Promise<void>;
};
export type RouteContext = { params: Promise<Record<string, string | string[] | undefined>> };
export type HttpError = { httpError: { code: string; message: string } };
