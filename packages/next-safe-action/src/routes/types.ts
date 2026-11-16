import type { ActionDefinition } from "../action-definition";
import type { InferSafeActionFnInput, InferServerError } from "../index.types";
import type { ErrorStatus, SuccessStatus } from "./http-status";

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
export type RouteOpenApi<Status extends ErrorStatus = ErrorStatus> = OpenApiErrors & {
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
	/**
	 * Every status that `serverErrorStatus` can return, including `500` if it can. Required with `serverErrorStatus`.
	 * On a route, the mapper may only return the statuses listed here.
	 */
	serverErrorStatuses?: readonly Status[];
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

// Error messages for path parameters that cannot be merged into the action input. They become the expected type of
// the path argument, so TypeScript shows them right on the path.
type ParamErrors<Input, Names extends string> = [Exclude<Input, undefined>] extends [infer Obj]
	? [Obj] extends [Record<string, unknown>]
		? Exclude<Names, keyof Obj> extends infer Missing extends string
			? [Missing] extends [never]
				? { [K in Names]: string extends Obj[K & keyof Obj] ? never : K }[Names] extends infer Strict extends string
					? [Strict] extends [never]
						? never
						: `Path parameter {${Strict}} must accept a string (for example z.coerce.number()); or use mapInput`
					: never
				: `Path parameter {${Missing}} is not a key of the action input; rename it or use mapInput`
			: never
		: "Path parameters need an object input; use mapInput"
	: never;
/** The type of the path argument: the path itself when its `{param}` segments merge into the input, otherwise an error. */
export type CheckPath<Action extends RouteAction, Path extends string, FullPath extends string> = [
	PathParamNames<FullPath>,
] extends [never]
	? Path
	: [ParamErrors<ActionInput<Action>, PathParamNames<FullPath>>] extends [infer Error extends string]
		? [Error] extends [never]
			? Path
			: Error
		: Path;

// `Status` is inferred from `openapi.serverErrorStatuses` (literals such as `409` or `HttpStatus.Conflict`), and
// `serverErrorStatus` may only return those statuses, so the document lists every status the route can send. It is
// not inferred from the mapper: the mapper's `error` parameter is contextually typed, so TypeScript reads it last.
type BaseRouteConfig<Action extends RouteAction, Status extends ErrorStatus> = {
	successStatus?: SuccessStatus;
	headers?: HeadersInit;
	serverErrorStatus?: (error: InferServerError<Action>) => NoInfer<Status>;
	openapi?: RouteOpenApi<Status>;
} & (IsStateful<Action> extends true ? { stateSchema: Schema } : { stateSchema?: never });
/**
 * Per-route HTTP configuration. Path parameters merge into the input object unless `mapInput` builds the input, and
 * `stateSchema` is required for stateful actions.
 */
export type RouteConfig<
	Action extends RouteAction,
	Path extends string,
	Status extends ErrorStatus = ErrorStatus,
> = BaseRouteConfig<Action, Status> & {
	mapInput?: MapInput<Action, Path>;
};

type RouteConfigArgs<Action extends RouteAction, Status extends ErrorStatus> =
	{} extends BaseRouteConfig<Action, Status>
		? [config?: BaseRouteConfig<Action, Status> & { mapInput?: never }]
		: [config: BaseRouteConfig<Action, Status> & { mapInput?: never }];
// Config types are derived from the full path, so `{param}` segments in the router prefix are typed too. The first
// signature covers routes with `mapInput`; the second merges path parameters and checks them on the path argument.
type AddRoute<Prefix extends string> = {
	<Action extends RouteAction, Path extends string, Status extends ErrorStatus = ErrorStatus>(
		action: Action,
		path: Path,
		config: BaseRouteConfig<Action, Status> & { mapInput: MapInput<Action, `${Prefix}${Path}`> }
	): Router<Prefix>;
	<Action extends RouteAction, Path extends string, Status extends ErrorStatus = ErrorStatus>(
		action: Action,
		path: CheckPath<Action, Path, `${Prefix}${Path}`>,
		...config: RouteConfigArgs<Action, Status>
	): Router<Prefix>;
};

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

/**
 * An immutable route table. Each method returns a new router with the route added, with the router prefix joined to
 * its path.
 */
export type Router<Prefix extends string = ""> = Readonly<{
	routes: readonly Route[];
	post: AddRoute<Prefix>;
	put: AddRoute<Prefix>;
	patch: AddRoute<Prefix>;
	delete: AddRoute<Prefix>;
}>;

export type RouteHandlersOptions = {
	pathParam?: string;
	maxBodyBytes?: number;
	/** Other origins that the origin check accepts. The route handlers send no CORS headers. */
	allowedOrigins?: readonly string[];
	/** Receives the original error behind every sanitized 500 response. The response stays sanitized and is not delayed. */
	onError?: (error: unknown, context: { request: Request }) => void | Promise<void>;
};
export type RouteContext = { params: Promise<Record<string, string | string[] | undefined>> };
export type HttpError = { httpError: { code: string; message: string } };
