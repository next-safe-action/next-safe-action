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
export type ValidationErrorsFormat = "formatted" | "flattened";

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
 * Brand applied to action functions created from clients with `throwValidationErrors: true`.
 * Used by adapters (e.g., TanStack Query) to reject incompatible actions at the type level.
 */
declare const THROWS_ERRORS: unique symbol;
export type ThrowsErrorsBrand = { readonly [THROWS_ERRORS]: true };

/**
 * Conditionally brand a type based on whether throws is enabled.
 */
export type MaybeBrandThrows<T, Throws extends boolean> = Throws extends true ? T & ThrowsErrorsBrand : T;

/**
 * Constraint type that rejects actions branded with `ThrowsErrorsBrand`.
 * Used by adapters (e.g., TanStack Query) to ensure only non-throwing actions are accepted.
 * An optional `never` property means: absent is OK, but present-with-a-value fails.
 */
export type NonThrowingActionConstraint = { readonly [THROWS_ERRORS]?: never };

/**
 * Detect if action-level `throwServerError` is set to `true`.
 */
type ActionUtilsThrowServer<U> = U extends { throwServerError: true } ? true : false;

/**
 * Detect if action-level `throwValidationErrors` is set to `true` (or the object form with `overrideErrorMessage`).
 * Returns `true` if enabled, `false` if explicitly disabled, `undefined` if not specified.
 */
type ActionUtilsThrowValidation<U> = U extends {
	throwValidationErrors: true | { overrideErrorMessage: (...args: any[]) => any };
}
	? true
	: U extends { throwValidationErrors: false }
		? false
		: undefined;

/**
 * Determine whether an action effectively throws errors, combining client-level and action-level settings.
 * Action-level settings take precedence over client-level defaults.
 */
export type EffectiveThrows<ClientThrows extends boolean, U> =
	ActionUtilsThrowServer<U> extends true
		? true
		: ActionUtilsThrowValidation<U> extends true
			? true
			: ActionUtilsThrowValidation<U> extends false
				? false
				: ClientThrows;

/**
 * Type of the arguments passed to the `SafeActionClient` constructor.
 */
export type SafeActionClientArgs<
	ServerError,
	ErrorsFormat extends ValidationErrorsFormat | undefined, // override default validation errors shape
	MetadataSchema extends StandardSchemaV1 | undefined = undefined,
	Metadata = InferOutputOrDefault<MetadataSchema, undefined>, // metadata type (inferred from metadata schema)
	HasMetadata extends boolean = MetadataSchema extends undefined ? true : false,
	Ctx extends object = {},
	InputSchemaFn extends ((clientInput?: unknown) => Promise<StandardSchemaV1>) | undefined = undefined, // input schema function
	InputSchema extends StandardSchemaV1 | undefined = InputSchemaFn extends Function
		? Awaited<ReturnType<InputSchemaFn>>
		: undefined, // input schema
	OutputSchema extends StandardSchemaV1 | undefined = undefined, // output schema
	BindArgsSchemas extends readonly StandardSchemaV1[] = [], // bind args schemas
	ShapedErrors = undefined, // custom validation errors shape
	ThrowsValidationErrors extends boolean = false, // whether the client throws validation errors
	HasValidatedMiddleware extends boolean = false, // whether useValidated() has been called
	PreValidationCtx extends object = Ctx, // context from use() middleware only (before validation)
> = {
	middlewareFns: MiddlewareFn<ServerError, any, any, any>[];
	validatedMiddlewareFns: ValidatedMiddlewareFn<ServerError, any, any, any, any, any, any, any>[];
	metadataSchema: MetadataSchema;
	metadata: Metadata;
	metadataProvided?: HasMetadata;
	inputSchemaFn: InputSchemaFn;
	outputSchema: OutputSchema;
	bindArgsSchemas: BindArgsSchemas;
	handleValidationErrorsShape: HandleValidationErrorsShapeFn<InputSchema, BindArgsSchemas, Metadata, Ctx, ShapedErrors>;
	ctxType: Ctx;
	preValidationCtxType: PreValidationCtx;
	handleServerError: HandleServerErrorFn<ServerError, MetadataSchema>;
	defaultValidationErrorsShape: ErrorsFormat;
	throwValidationErrors: ThrowsValidationErrors;
	hasValidatedMiddleware?: HasValidatedMiddleware;
};

/**
 * Type of options when creating a new safe action client.
 */
export type CreateClientOpts<
	ErrorsFormat extends ValidationErrorsFormat | undefined = undefined,
	ServerError = string,
	MetadataSchema extends StandardSchemaV1 | undefined = undefined,
	ThrowsValidationErrors extends boolean = false,
> = {
	defineMetadataSchema?: () => MetadataSchema;
	handleServerError?: HandleServerErrorFn<ServerError, MetadataSchema>;
	defaultValidationErrorsShape?: ErrorsFormat;
	throwValidationErrors?: ThrowsValidationErrors;
};

/**
 * Type of the result of a safe action.
 *
 * Modeled as a discriminated union so that checking one field narrows the
 * others to `undefined`. The runtime guarantees mutual exclusion (see
 * `buildResultAndRunCallbacks` in `action-builder.ts`), and this type makes
 * that guarantee visible to consumers:
 *
 * ```ts
 * const { data, serverError, validationErrors } = await myAction(input);
 *
 * if (data) {
 *   // TS knows serverError and validationErrors are undefined here
 * }
 * ```
 *
 * Branches:
 * - idle / initial state (e.g. `useAction`'s `useState<Result>({})`)
 * - success (only `data` is set)
 * - server error (only `serverError` is set)
 * - validation error (only `validationErrors` is set)
 *
 * Note: when `Data` is `void` (the action returns nothing), the success
 * branch's `data` becomes `void`, which is indistinguishable from the idle
 * branch's `data?: undefined` at read time. For public, user-facing types
 * (`SafeActionFn`, `SafeStateActionFn`, hook return types), `NormalizeActionResult`
 * is applied at the boundary to drop the void-success branch entirely,
 * giving `r.data` an exact `undefined` type. This type is kept unconditional
 * so that internal builders in `action-builder.ts` and `hooks-shared.ts`
 * can construct `{ data: Data }` assignments without fighting deferred
 * conditional types.
 */
export type SafeActionResult<
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors = ValidationErrors<Schema>,
	Data = unknown,
	// oxlint-disable-next-line
	NextCtx = object,
> =
	| { data?: undefined; serverError?: undefined; validationErrors?: undefined }
	| { data: Data; serverError?: undefined; validationErrors?: undefined }
	| { data?: undefined; serverError: ServerError; validationErrors?: undefined }
	| { data?: undefined; serverError?: undefined; validationErrors: ShapedErrors };

/**
 * Collapses the void-success branch of a `SafeActionResult` union.
 *
 * The runtime never emits `{ data: undefined }` for a void-returning action
 * (see `buildResultAndRunCallbacks` in `action-builder.ts` — it only sets
 * `data` when `middlewareResult.data !== undefined`). For user-facing types,
 * we drop the `{ data: void }` branch so that `r.data` narrows to exactly
 * `undefined` instead of `void | undefined`.
 *
 * This is a distributive conditional — each member of the input union is
 * checked individually. Only the exact `{ data: void }` shape is excluded;
 * other branches (idle, server error, validation error) pass through.
 *
 * When `Data` is not exactly `void`, the success branch doesn't match the
 * filter and the whole union is returned unchanged.
 */
export type NormalizeActionResult<R> = R extends { data: infer D }
	? [D] extends [void]
		? Exclude<R, { data: D }>
		: R
	: R;

/**
 * Type of the function called from components with type safe input data.
 *
 * The awaited result is run through `NormalizeActionResult` so that
 * void-returning actions expose `data: undefined` rather than `data: void | undefined`.
 */
export type SafeActionFn<
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	BindArgsSchemas extends readonly StandardSchemaV1[],
	ShapedErrors,
	Data,
> = (
	...clientInputs: [...bindArgsInputs: InferInputArray<BindArgsSchemas>, input: InferInputOrDefault<Schema, void>]
) => Promise<NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>>;

/**
 * Type of the stateful function called from components with type safe input data.
 *
 * Both `prevResult` and the awaited result are run through `NormalizeActionResult`
 * so that `useStateAction` consumers see `data: undefined` for void-returning actions.
 */
export type SafeStateActionFn<
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	BindArgsSchemas extends readonly StandardSchemaV1[],
	ShapedErrors,
	Data,
> = (
	...clientInputs: [
		...bindArgsInputs: InferInputArray<BindArgsSchemas>,
		prevResult: Prettify<NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>>,
		input: InferInputOrDefault<Schema, void>,
	]
) => Promise<NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>>;

/**
 * Type of the result of a middleware function. Carries the same data/error fields as
 * `SafeActionResult` plus internal bookkeeping (navigation kind, parsed inputs, context,
 * success flag).
 *
 * This is intentionally a flat object rather than `SafeActionResult & { ... }`, because
 * `SafeActionResult` is now a discriminated union and intersecting it with additional
 * fields would prevent mutation of `data`/`serverError`/`validationErrors` during
 * middleware execution. The public shape (the set of readable fields) is unchanged.
 *
 * `NextCtx` is a phantom generic parameter kept for backward compatibility with the
 * previous signature — it is intentionally unused in the body so that
 * `MiddlewareResult<SE, A>` and `MiddlewareResult<SE, B>` remain mutually assignable
 * (as they were when this type intersected `SafeActionResult<..., NextCtx>`, where
 * `NextCtx` was likewise phantom).
 */
// `data` and `validationErrors` are intentionally typed as `any` to match the
// previous definition (`SafeActionResult<ServerError, any, any, any, NextCtx>
// & { ... }`), preserving universal-donor assignability for middleware authors
// who inspect the return value of `await next()`.
// oxlint-disable-next-line no-unused-vars
export type MiddlewareResult<ServerError, NextCtx extends object> = {
	data?: any;
	serverError?: ServerError;
	validationErrors?: any;
	navigationKind?: NavigationKind;
	parsedInput?: unknown;
	bindArgsParsedInputs?: unknown[];
	ctx?: object;
	success: boolean;
};

/**
 * Type of the middleware function passed to a safe action client.
 */
export type MiddlewareFn<ServerError, Metadata, Ctx extends object, NextCtx extends object> = {
	(opts: {
		clientInput: unknown;
		bindArgsClientInputs: unknown[];
		ctx: Prettify<Ctx>;
		metadata: Metadata;
		next: {
			<NC extends object = {}>(opts?: { ctx?: NC }): Promise<MiddlewareResult<ServerError, NC>>;
		};
	}): Promise<MiddlewareResult<ServerError, NextCtx>>;
};

/**
 * Type of the validated middleware function passed to a safe action client via `useValidated()`.
 * Executed after input validation, receives typed parsed inputs.
 */
export type ValidatedMiddlewareFn<
	ServerError,
	Metadata,
	Ctx extends object,
	NextCtx extends object,
	ParsedInput = unknown,
	ClientInput = unknown,
	BindArgsParsedInputs extends readonly unknown[] = readonly unknown[],
	BindArgsClientInputs extends readonly unknown[] = readonly unknown[],
> = {
	(opts: {
		parsedInput: ParsedInput;
		clientInput: ClientInput;
		bindArgsParsedInputs: BindArgsParsedInputs;
		bindArgsClientInputs: BindArgsClientInputs;
		ctx: Prettify<Ctx>;
		metadata: Metadata;
		next: {
			<NC extends object = {}>(opts?: { ctx?: NC }): Promise<MiddlewareResult<ServerError, NC>>;
		};
	}): Promise<MiddlewareResult<ServerError, NextCtx>>;
};

/**
 * Type of the function that executes server code when defining a new safe action.
 */
export type ServerCodeFn<
	Metadata,
	Ctx extends object,
	Schema extends StandardSchemaV1 | undefined,
	BindArgsSchemas extends readonly StandardSchemaV1[],
	Data,
> = (args: {
	parsedInput: InferOutputOrDefault<Schema, undefined>;
	clientInput: InferInputOrDefault<Schema, undefined>;
	bindArgsParsedInputs: InferOutputArray<BindArgsSchemas>;
	bindArgsClientInputs: InferInputArray<BindArgsSchemas>;
	ctx: Prettify<Ctx>;
	metadata: Metadata;
}) => Promise<Data>;

/**
 * Type of the function that executes server code when defining a new stateful safe action.
 */
export type StatefulServerCodeFn<
	ServerError,
	Metadata,
	Ctx extends object,
	Schema extends StandardSchemaV1 | undefined,
	BindArgsSchemas extends readonly StandardSchemaV1[],
	ShapedErrors,
	Data,
> = (
	args: {
		parsedInput: InferOutputOrDefault<Schema, undefined>;
		clientInput: InferInputOrDefault<Schema, undefined>;
		bindArgsParsedInputs: InferOutputArray<BindArgsSchemas>;
		bindArgsClientInputs: InferInputArray<BindArgsSchemas>;
		ctx: Prettify<Ctx>;
		metadata: Metadata;
	},
	utils: { prevResult: Prettify<SafeActionResult<ServerError, Schema, ShapedErrors, Data>> }
) => Promise<Data>;

/**
 * Possible types of navigation.
 */
export type NavigationKind = "redirect" | "notFound" | "forbidden" | "unauthorized" | "other";

/**
 * Type of action execution callbacks and options.
 */
export type ActionCallbacks<
	ServerError,
	Metadata,
	Ctx extends object,
	Schema extends StandardSchemaV1 | undefined,
	BindArgsSchemas extends readonly StandardSchemaV1[],
	ShapedErrors,
	Data,
	PreValidationCtx extends object = Ctx,
> = {
	throwServerError?: boolean;
	throwValidationErrors?: boolean | { overrideErrorMessage: (validationErrors: ShapedErrors) => Promise<string> };
	onSuccess?: (args: {
		data?: Data;
		metadata: Metadata;
		ctx?: Prettify<Ctx>;
		clientInput: InferInputOrDefault<Schema, undefined>;
		bindArgsClientInputs: InferInputArray<BindArgsSchemas>;
		parsedInput: InferOutputOrDefault<Schema, undefined>;
		bindArgsParsedInputs: InferOutputArray<BindArgsSchemas>;
	}) => Promise<unknown>;
	onNavigation?: (args: {
		metadata: Metadata;
		ctx?: Prettify<PreValidationCtx & Partial<Ctx>>;
		clientInput: InferInputOrDefault<Schema, undefined>;
		bindArgsClientInputs: InferInputArray<BindArgsSchemas>;
		navigationKind: NavigationKind;
	}) => Promise<unknown>;
	onError?: (args: {
		error: Prettify<Omit<SafeActionResult<ServerError, Schema, ShapedErrors, Data>, "data">>;
		metadata: Metadata;
		ctx?: Prettify<PreValidationCtx & Partial<Ctx>>;
		clientInput: InferInputOrDefault<Schema, undefined>;
		bindArgsClientInputs: InferInputArray<BindArgsSchemas>;
	}) => Promise<unknown>;
	onSettled?: (args: {
		result: Prettify<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>;
		metadata: Metadata;
		ctx?: Prettify<PreValidationCtx & Partial<Ctx>>;
		clientInput: InferInputOrDefault<Schema, undefined>;
		bindArgsClientInputs: InferInputArray<BindArgsSchemas>;
		navigationKind?: NavigationKind;
	}) => Promise<unknown>;
};

/**
 * Infer input types of a safe action.
 */
export type InferSafeActionFnInput<T extends Function> = T extends
	| SafeActionFn<
			any,
			infer Schema extends StandardSchemaV1 | undefined,
			infer BindArgsSchemas extends readonly StandardSchemaV1[],
			any,
			any
	  >
	| SafeStateActionFn<
			any,
			infer Schema extends StandardSchemaV1 | undefined,
			infer BindArgsSchemas extends readonly StandardSchemaV1[],
			any,
			any
	  >
	? Schema extends StandardSchemaV1
		? {
				clientInput: StandardSchemaV1.InferInput<Schema>;
				bindArgsClientInputs: InferInputArray<BindArgsSchemas>;
				parsedInput: StandardSchemaV1.InferOutput<Schema>;
				bindArgsParsedInputs: InferOutputArray<BindArgsSchemas>;
			}
		: {
				clientInput: undefined;
				bindArgsClientInputs: InferInputArray<BindArgsSchemas>;
				parsedInput: undefined;
				bindArgsParsedInputs: InferOutputArray<BindArgsSchemas>;
			}
	: never;

/**
 * Infer the result type of a safe action.
 *
 * Extracted via `Awaited<ReturnType<T>>` so that the `NormalizeActionResult`
 * wrapper applied in `SafeActionFn`/`SafeStateActionFn` flows through (i.e.
 * void-returning actions yield `data: undefined` rather than `data: void`).
 */
export type InferSafeActionFnResult<T extends Function> = T extends (...args: any[]) => Promise<infer R> ? R : never;

/**
 * Infer the next context type returned by a middleware function using the `next` function.
 */
export type InferMiddlewareFnNextCtx<T> =
	T extends MiddlewareFn<any, any, any, infer NextCtx extends object> ? NextCtx : never;

/**
 * Infer the next context type returned by a validated middleware function using the `next` function.
 */
export type InferValidatedMiddlewareFnNextCtx<T> =
	T extends ValidatedMiddlewareFn<any, any, any, infer NextCtx extends object, any, any, any, any> ? NextCtx : never;

/**
 * Infer the context type of a safe action client or middleware function.
 */
export type InferCtx<T> = T extends
	| SafeActionClient<any, any, any, any, false, infer Ctx extends object, any, any, any, any, any, any, any, any>
	| MiddlewareFn<any, any, infer Ctx extends object, any>
	| ValidatedMiddlewareFn<any, any, infer Ctx extends object, any, any, any, any, any>
	? Ctx
	: never;

/**
 * Infer the metadata type of a safe action client or middleware function.
 */
export type InferMetadata<T> = T extends
	| SafeActionClient<any, any, any, infer Metadata, false, any, any, any, any, any, any, any, any, any>
	| MiddlewareFn<any, infer Metadata, any, any>
	| ValidatedMiddlewareFn<any, infer Metadata, any, any, any, any, any, any>
	? Metadata
	: never;

/**
 * Infer the server error type from a safe action client or a middleware function or a safe action function.
 */
export type InferServerError<T> = T extends
	| SafeActionClient<infer ServerError, any, any, any, any, any, any, any, any, any, any, any, any, any>
	| MiddlewareFn<infer ServerError, any, any, any>
	| ValidatedMiddlewareFn<infer ServerError, any, any, any, any, any, any, any>
	| SafeActionFn<infer ServerError, any, any, any, any>
	| SafeStateActionFn<infer ServerError, any, any, any, any>
	? ServerError
	: never;

/**
 * Type of the core safe action client.
 */
export { SafeActionClient };

/**
 * Deprecated aliases kept for backward compatibility.
 */

/**
 * @deprecated Use `ValidationErrorsFormat` instead.
 */
export type DVES = ValidationErrorsFormat;

/**
 * @deprecated Use `StatefulServerCodeFn` instead.
 */
export type StateServerCodeFn<
	ServerError,
	Metadata,
	Ctx extends object,
	Schema extends StandardSchemaV1 | undefined,
	BindArgsSchemas extends readonly StandardSchemaV1[],
	ShapedErrors,
	Data,
> = StatefulServerCodeFn<ServerError, Metadata, Ctx, Schema, BindArgsSchemas, ShapedErrors, Data>;

/**
 * @deprecated Use `ActionCallbacks` instead.
 */
export type SafeActionUtils<
	ServerError,
	Metadata,
	Ctx extends object,
	Schema extends StandardSchemaV1 | undefined,
	BindArgsSchemas extends readonly StandardSchemaV1[],
	ShapedErrors,
	Data,
> = ActionCallbacks<ServerError, Metadata, Ctx, Schema, BindArgsSchemas, ShapedErrors, Data>;
