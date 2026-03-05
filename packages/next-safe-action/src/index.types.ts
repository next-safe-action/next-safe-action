import type { SafeActionClient } from "./safe-action-client";
import type {
	InferInputArray,
	InferInputOrDefault,
	InferOutputArray,
	InferOutputOrDefault,
	StandardSchemaV1,
} from "./standard-schema";
import type { MaybePromise, Prettify } from "./utils.types";
import type { HandleValidationErrorsShapeFn, ValidationErrors } from "./validation-errors.types";

/**
 * Type of the default validation errors shape passed to `createSafeActionClient` via `defaultValidationErrorsShape`
 * property.
 */
export type DVES = "formatted" | "flattened";

/**
 * Type of the options passed to the input schema factory function.
 */
export type InputSchemaClientOpts = {
	clientInput: unknown;
};

/**
 * Type of the input schema factory function.
 */
export type InputSchemaFactoryFn<
	PrevSchema extends StandardSchemaV1 | undefined,
	NextSchema extends StandardSchemaV1 = StandardSchemaV1,
> = (prevSchema: PrevSchema, opts: InputSchemaClientOpts) => Promise<NextSchema>;

/**
 * Type of the util properties passed to server error handler functions.
 */
export type ServerErrorFunctionUtils<MetadataSchema extends StandardSchemaV1 | undefined> = {
	clientInput: unknown;
	bindArgsClientInputs: unknown[];
	ctx: object;
	metadata: InferOutputOrDefault<MetadataSchema, undefined>;
};

export type HandleServerErrorFn<
	ServerError = string,
	MetadataSchema extends StandardSchemaV1 | undefined = undefined,
> = (error: Error, utils: ServerErrorFunctionUtils<MetadataSchema>) => MaybePromise<ServerError>;

/**
 * Type of the arguments passed to the `SafeActionClient` constructor.
 */
export type SafeActionClientArgs<
	ServerError,
	ODVES extends DVES | undefined, // override default validation errors shape
	MetadataSchema extends StandardSchemaV1 | undefined = undefined,
	MD = InferOutputOrDefault<MetadataSchema, undefined>, // metadata type (inferred from metadata schema)
	MDProvided extends boolean = MetadataSchema extends undefined ? true : false,
	Ctx extends object = {},
	ISF extends ((clientInput?: unknown) => Promise<StandardSchemaV1>) | undefined = undefined, // input schema function
	IS extends StandardSchemaV1 | undefined = ISF extends Function ? Awaited<ReturnType<ISF>> : undefined, // input schema
	OS extends StandardSchemaV1 | undefined = undefined, // output schema
	BAS extends readonly StandardSchemaV1[] = [], // bind args schemas
	CVE = undefined, // custom validation errors shape
> = {
	middlewareFns: MiddlewareFn<ServerError, any, any, any>[];
	metadataSchema: MetadataSchema;
	metadata: MD;
	metadataProvided?: MDProvided;
	inputSchemaFn: ISF;
	outputSchema: OS;
	bindArgsSchemas: BAS;
	handleValidationErrorsShape: HandleValidationErrorsShapeFn<IS, BAS, MD, Ctx, CVE>;
	ctxType: Ctx;
	handleServerError: HandleServerErrorFn<ServerError, MetadataSchema>;
	defaultValidationErrorsShape: ODVES;
	throwValidationErrors: boolean;
};

/**
 * Type of options when creating a new safe action client.
 */
export type CreateClientOpts<
	ODVES extends DVES | undefined = undefined,
	ServerError = string,
	MetadataSchema extends StandardSchemaV1 | undefined = undefined,
> = {
	defineMetadataSchema?: () => MetadataSchema;
	handleServerError?: HandleServerErrorFn<ServerError, MetadataSchema>;
	defaultValidationErrorsShape?: ODVES;
	throwValidationErrors?: boolean;
};

/**
 * Type of the result of a safe action.
 */
export type SafeActionResult<
	ServerError,
	S extends StandardSchemaV1 | undefined,
	CVE = ValidationErrors<S>,
	Data = unknown,
	// oxlint-disable-next-line
	NextCtx = object,
> = {
	data?: Data;
	serverError?: ServerError;
	validationErrors?: CVE;
};

/**
 * Type of the function called from components with type safe input data.
 */
export type SafeActionFn<
	ServerError,
	S extends StandardSchemaV1 | undefined,
	BAS extends readonly StandardSchemaV1[],
	CVE,
	Data,
> = (
	...clientInputs: [...bindArgsInputs: InferInputArray<BAS>, input: InferInputOrDefault<S, void>]
) => Promise<SafeActionResult<ServerError, S, CVE, Data>>;

/**
 * Type of the stateful function called from components with type safe input data.
 */
export type SafeStateActionFn<
	ServerError,
	S extends StandardSchemaV1 | undefined,
	BAS extends readonly StandardSchemaV1[],
	CVE,
	Data,
> = (
	...clientInputs: [
		...bindArgsInputs: InferInputArray<BAS>,
		prevResult: Prettify<SafeActionResult<ServerError, S, CVE, Data>>,
		input: InferInputOrDefault<S, void>,
	]
) => Promise<SafeActionResult<ServerError, S, CVE, Data>>;

/**
 * Type of the result of a middleware function. It extends the result of a safe action with
 * information about the action execution.
 */
export type MiddlewareResult<ServerError, NextCtx extends object> = SafeActionResult<
	ServerError,
	any,
	any,
	any,
	NextCtx
> & {
	navigationKind?: NavigationKind;
	parsedInput?: unknown;
	bindArgsParsedInputs?: unknown[];
	ctx?: object;
	success: boolean;
};

/**
 * Type of the middleware function passed to a safe action client.
 */
export type MiddlewareFn<ServerError, MD, Ctx extends object, NextCtx extends object> = {
	(opts: {
		clientInput: unknown;
		bindArgsClientInputs: unknown[];
		ctx: Prettify<Ctx>;
		metadata: MD;
		next: {
			<NC extends object = {}>(opts?: { ctx?: NC }): Promise<MiddlewareResult<ServerError, NC>>;
		};
	}): Promise<MiddlewareResult<ServerError, NextCtx>>;
};

/**
 * Type of the function that executes server code when defining a new safe action.
 */
export type ServerCodeFn<
	MD,
	Ctx extends object,
	S extends StandardSchemaV1 | undefined,
	BAS extends readonly StandardSchemaV1[],
	Data,
> = (args: {
	parsedInput: InferOutputOrDefault<S, undefined>;
	clientInput: InferInputOrDefault<S, undefined>;
	bindArgsParsedInputs: InferOutputArray<BAS>;
	bindArgsClientInputs: InferInputArray<BAS>;
	ctx: Prettify<Ctx>;
	metadata: MD;
}) => Promise<Data>;

/**
 * Type of the function that executes server code when defining a new stateful safe action.
 */
export type StateServerCodeFn<
	ServerError,
	MD,
	Ctx extends object,
	S extends StandardSchemaV1 | undefined,
	BAS extends readonly StandardSchemaV1[],
	CVE,
	Data,
> = (
	args: {
		parsedInput: InferOutputOrDefault<S, undefined>;
		clientInput: InferInputOrDefault<S, undefined>;
		bindArgsParsedInputs: InferOutputArray<BAS>;
		bindArgsClientInputs: InferInputArray<BAS>;
		ctx: Prettify<Ctx>;
		metadata: MD;
	},
	utils: { prevResult: Prettify<SafeActionResult<ServerError, S, CVE, Data>> }
) => Promise<Data>;

/**
 * Possible types of navigation.
 */
export type NavigationKind = "redirect" | "notFound" | "forbidden" | "unauthorized" | "other";

/**
 * Type of action execution utils. It includes action callbacks and other utils.
 */
export type SafeActionUtils<
	ServerError,
	MD,
	Ctx extends object,
	S extends StandardSchemaV1 | undefined,
	BAS extends readonly StandardSchemaV1[],
	CVE,
	Data,
> = {
	throwServerError?: boolean;
	throwValidationErrors?: boolean | { overrideErrorMessage: (validationErrors: CVE) => Promise<string> };
	onSuccess?: (args: {
		data?: Data;
		metadata: MD;
		ctx?: Prettify<Ctx>;
		clientInput: InferInputOrDefault<S, undefined>;
		bindArgsClientInputs: InferInputArray<BAS>;
		parsedInput: InferOutputOrDefault<S, undefined>;
		bindArgsParsedInputs: InferOutputArray<BAS>;
	}) => Promise<unknown>;
	onNavigation?: (args: {
		metadata: MD;
		ctx?: Prettify<Ctx>;
		clientInput: InferInputOrDefault<S, undefined>;
		bindArgsClientInputs: InferInputArray<BAS>;
		navigationKind: NavigationKind;
	}) => Promise<unknown>;
	onError?: (args: {
		error: Prettify<Omit<SafeActionResult<ServerError, S, CVE, Data>, "data">>;
		metadata: MD;
		ctx?: Prettify<Ctx>;
		clientInput: InferInputOrDefault<S, undefined>;
		bindArgsClientInputs: InferInputArray<BAS>;
	}) => Promise<unknown>;
	onSettled?: (args: {
		result: Prettify<SafeActionResult<ServerError, S, CVE, Data>>;
		metadata: MD;
		ctx?: Prettify<Ctx>;
		clientInput: InferInputOrDefault<S, undefined>;
		bindArgsClientInputs: InferInputArray<BAS>;
		navigationKind?: NavigationKind;
	}) => Promise<unknown>;
};

/**
 * Infer input types of a safe action.
 */
export type InferSafeActionFnInput<T extends Function> = T extends
	| SafeActionFn<
			any,
			infer S extends StandardSchemaV1 | undefined,
			infer BAS extends readonly StandardSchemaV1[],
			any,
			any
	  >
	| SafeStateActionFn<
			any,
			infer S extends StandardSchemaV1 | undefined,
			infer BAS extends readonly StandardSchemaV1[],
			any,
			any
	  >
	? S extends StandardSchemaV1
		? {
				clientInput: StandardSchemaV1.InferInput<S>;
				bindArgsClientInputs: InferInputArray<BAS>;
				parsedInput: StandardSchemaV1.InferOutput<S>;
				bindArgsParsedInputs: InferOutputArray<BAS>;
			}
		: {
				clientInput: undefined;
				bindArgsClientInputs: InferInputArray<BAS>;
				parsedInput: undefined;
				bindArgsParsedInputs: InferOutputArray<BAS>;
			}
	: never;

/**
 * Infer the result type of a safe action.
 */
export type InferSafeActionFnResult<T extends Function> = T extends
	| SafeActionFn<infer ServerError, infer S extends StandardSchemaV1 | undefined, any, infer CVE, infer Data>
	| SafeStateActionFn<infer ServerError, infer S extends StandardSchemaV1 | undefined, any, infer CVE, infer Data>
	? SafeActionResult<ServerError, S, CVE, Data>
	: never;

/**
 * Infer the next context type returned by a middleware function using the `next` function.
 */
export type InferMiddlewareFnNextCtx<T> =
	T extends MiddlewareFn<any, any, any, infer NextCtx extends object> ? NextCtx : never;

/**
 * Infer the context type of a safe action client or middleware function.
 */
export type InferCtx<T> = T extends
	| SafeActionClient<any, any, any, any, false, infer Ctx extends object, any, any, any, any, any>
	| MiddlewareFn<any, any, infer Ctx extends object, any>
	? Ctx
	: never;

/**
 * Infer the metadata type of a safe action client or middleware function.
 */
export type InferMetadata<T> = T extends
	| SafeActionClient<any, any, any, infer MD, false, any, any, any, any, any, any>
	| MiddlewareFn<any, infer MD, any, any>
	? MD
	: never;

/**
 * Infer the server error type from a safe action client or a middleware function or a safe action function.
 */
export type InferServerError<T> = T extends
	| SafeActionClient<infer ServerError, any, any, any, any, any, any, any, any, any, any>
	| MiddlewareFn<infer ServerError, any, any, any>
	| SafeActionFn<infer ServerError, any, any, any, any>
	| SafeStateActionFn<infer ServerError, any, any, any, any>
	? ServerError
	: never;

/**
 * Type of the core safe action client.
 */
export { SafeActionClient };
