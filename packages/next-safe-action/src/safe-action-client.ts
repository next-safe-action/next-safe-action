import { actionBuilder } from "./action-builder";
import type {
	ValidationErrorsFormat,
	EffectiveThrows,
	InputSchemaFactoryFn,
	MaybeBrandThrows,
	MiddlewareFn,
	ValidatedMiddlewareFn,
	SafeActionClientArgs,
	SafeActionFn,
	SafeStateActionFn,
	ActionCallbacks,
	ServerCodeFn,
	StatefulServerCodeFn,
} from "./index.types";
import type { InferInputOrDefault, InferInputArray, InferOutputOrDefault, InferOutputArray, StandardSchemaV1 } from "./standard-schema";
import { isStandardSchema } from "./standard-schema";
import type {
	FlattenedValidationErrors,
	HandleValidationErrorsShapeFn,
	ValidationErrors,
} from "./validation-errors.types";

export class SafeActionClient<
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
	const BindArgsSchemas extends readonly StandardSchemaV1[] = [],
	ShapedErrors = undefined,
	ThrowsValidationErrors extends boolean = false,
	HasValidatedMiddleware extends boolean = false,
	PreValidationCtx extends object = Ctx,
> {
	readonly #args: SafeActionClientArgs<
		ServerError,
		ErrorsFormat,
		MetadataSchema,
		Metadata,
		HasMetadata,
		Ctx,
		InputSchemaFn,
		InputSchema,
		OutputSchema,
		BindArgsSchemas,
		ShapedErrors,
		ThrowsValidationErrors,
		HasValidatedMiddleware,
		PreValidationCtx
	>;

	constructor(
		args: SafeActionClientArgs<
			ServerError,
			ErrorsFormat,
			MetadataSchema,
			Metadata,
			HasMetadata,
			Ctx,
			InputSchemaFn,
			InputSchema,
			OutputSchema,
			BindArgsSchemas,
			ShapedErrors,
			ThrowsValidationErrors,
			HasValidatedMiddleware,
			PreValidationCtx
		>
	) {
		this.#args = args;
	}

	/**
	 * Use a middleware function. Middleware added via `use()` always runs **before** input validation.
	 * Cannot be called after `useValidated()`.
	 * @param middlewareFn Middleware function
	 *
	 * {@link https://next-safe-action.dev/docs/define-actions/instance-methods#use See docs for more information}
	 */
	use<NextCtx extends object>(
		this: HasValidatedMiddleware extends false
			? SafeActionClient<
					ServerError,
					ErrorsFormat,
					MetadataSchema,
					Metadata,
					HasMetadata,
					Ctx,
					InputSchemaFn,
					InputSchema,
					OutputSchema,
					BindArgsSchemas,
					ShapedErrors,
					ThrowsValidationErrors,
					HasValidatedMiddleware,
					PreValidationCtx
				>
			: never,
		middlewareFn: MiddlewareFn<ServerError, Metadata, Ctx, Ctx & NextCtx>
	) {
		if (this.#args.hasValidatedMiddleware) {
			throw new Error("use() cannot be called after useValidated(). Move all use() calls before useValidated().");
		}

		return new SafeActionClient({
			...this.#args,
			middlewareFns: [...this.#args.middlewareFns, middlewareFn],
			ctxType: {} as Ctx & NextCtx,
			preValidationCtxType: {} as PreValidationCtx & NextCtx,
		});
	}

	/**
	 * Use a validated middleware function. Middleware added via `useValidated()` runs **after** input
	 * validation and receives typed `parsedInput` and `bindArgsParsedInputs`.
	 *
	 * Requires `inputSchema()` or `bindArgsSchemas()` to be called before. After calling `useValidated()`,
	 * `inputSchema()` and `bindArgsSchemas()` can no longer be called.
	 *
	 * @param middlewareFn Validated middleware function
	 *
	 * {@link https://next-safe-action.dev/docs/define-actions/instance-methods#usevalidated See docs for more information}
	 */
	useValidated<NextCtx extends object>(
		this: [InputSchema, BindArgsSchemas] extends [undefined, readonly []]
			? never
			: SafeActionClient<
					ServerError,
					ErrorsFormat,
					MetadataSchema,
					Metadata,
					HasMetadata,
					Ctx,
					InputSchemaFn,
					InputSchema,
					OutputSchema,
					BindArgsSchemas,
					ShapedErrors,
					ThrowsValidationErrors,
					HasValidatedMiddleware,
					PreValidationCtx
				>,
		middlewareFn: ValidatedMiddlewareFn<
			ServerError,
			Metadata,
			Ctx,
			Ctx & NextCtx,
			InferOutputOrDefault<InputSchema, undefined>,
			InferInputOrDefault<InputSchema, undefined>,
			InferOutputArray<BindArgsSchemas>,
			InferInputArray<BindArgsSchemas>
		>
	) {
		return new SafeActionClient({
			...this.#args,
			validatedMiddlewareFns: [...this.#args.validatedMiddlewareFns, middlewareFn],
			ctxType: {} as Ctx & NextCtx,
			preValidationCtxType: {} as PreValidationCtx,
			hasValidatedMiddleware: true as const,
			handleValidationErrorsShape: this.#args.handleValidationErrorsShape as unknown as HandleValidationErrorsShapeFn<
				InputSchema,
				BindArgsSchemas,
				Metadata,
				Ctx & NextCtx,
				ShapedErrors
			>,
		});
	}

	/**
	 * Define metadata for the action.
	 * @param data Metadata with the same type as the return value of the [`defineMetadataSchema`](https://next-safe-action.dev/docs/define-actions/create-the-client#definemetadataschema) optional initialization function
	 *
	 * {@link https://next-safe-action.dev/docs/define-actions/instance-methods#metadata See docs for more information}
	 */
	metadata(data: Metadata) {
		return new SafeActionClient({
			...this.#args,
			metadata: data,
			metadataProvided: true,
		});
	}

	/**
	 * Define the input validation schema for the action.
	 * Cannot be called after `useValidated()`.
	 * @param inputSchema Input validation schema
	 * @param utils Optional utils object
	 *
	 * {@link https://next-safe-action.dev/docs/define-actions/create-the-client#inputschema See docs for more information}
	 */
	inputSchema<
		OIS extends StandardSchemaV1 | InputSchemaFactoryFn<InputSchema>, // override input schema
		AIS extends StandardSchemaV1 = OIS extends InputSchemaFactoryFn<InputSchema, infer NextSchema> // actual input schema
			? NextSchema
			: OIS,
		// override custom validation errors shape
		OShapedErrors = ErrorsFormat extends "flattened"
			? FlattenedValidationErrors<ValidationErrors<AIS>>
			: ValidationErrors<AIS>,
	>(
		this: HasValidatedMiddleware extends false
			? SafeActionClient<
					ServerError,
					ErrorsFormat,
					MetadataSchema,
					Metadata,
					HasMetadata,
					Ctx,
					InputSchemaFn,
					InputSchema,
					OutputSchema,
					BindArgsSchemas,
					ShapedErrors,
					ThrowsValidationErrors,
					HasValidatedMiddleware,
					PreValidationCtx
				>
			: never,
		inputSchema: OIS,
		utils?: {
			handleValidationErrorsShape?: HandleValidationErrorsShapeFn<AIS, BindArgsSchemas, Metadata, Ctx, OShapedErrors>;
		}
	) {
		const isDirectStandardSchema = isStandardSchema(inputSchema);
		const isInputSchemaFactoryFn =
			!isDirectStandardSchema &&
			typeof inputSchema === "function" &&
			Object.prototype.toString.call(inputSchema) === "[object AsyncFunction]";

		if (!isDirectStandardSchema && typeof inputSchema === "function" && !isInputSchemaFactoryFn) {
			throw new TypeError(
				"`inputSchema()` received a function that is not a Standard Schema validator. Pass a Standard Schema validator (`~standard.validate`) directly, or use an async function to build/extend the schema."
			);
		}

		return new SafeActionClient({
			...this.#args,
			inputSchemaFn: (isInputSchemaFactoryFn
				? async (clientInput?: unknown) => {
						const prevSchema = await this.#args.inputSchemaFn?.(clientInput);

						return (inputSchema as unknown as InputSchemaFactoryFn<InputSchema, AIS>)(prevSchema as InputSchema, {
							clientInput,
						});
					}
				: async () => inputSchema) as unknown as InputSchemaFn,
			handleValidationErrorsShape: (utils?.handleValidationErrorsShape ??
				this.#args.handleValidationErrorsShape) as HandleValidationErrorsShapeFn<
				AIS,
				BindArgsSchemas,
				Metadata,
				Ctx,
				OShapedErrors
			>,
		});
	}

	/**
	 * @deprecated Alias for `inputSchema` method. Use that instead.
	 */
	// oxlint-disable-next-line typescript/unbound-method
	schema = this.inputSchema;

	/**
	 * Define the bind args input validation schema for the action.
	 * Cannot be called after `useValidated()`.
	 * @param bindArgsSchemas Bind args input validation schemas
	 *
	 * {@link https://next-safe-action.dev/docs/define-actions/instance-methods#bindargsschemas See docs for more information}
	 */
	bindArgsSchemas<const OBindArgsSchemas extends readonly StandardSchemaV1[]>(
		this: HasValidatedMiddleware extends false
			? SafeActionClient<
					ServerError,
					ErrorsFormat,
					MetadataSchema,
					Metadata,
					HasMetadata,
					Ctx,
					InputSchemaFn,
					InputSchema,
					OutputSchema,
					BindArgsSchemas,
					ShapedErrors,
					ThrowsValidationErrors,
					HasValidatedMiddleware,
					PreValidationCtx
				>
			: never,
		bindArgsSchemas: OBindArgsSchemas
	) {
		return new SafeActionClient({
			...this.#args,
			bindArgsSchemas,
			handleValidationErrorsShape: this.#args.handleValidationErrorsShape as unknown as HandleValidationErrorsShapeFn<
				InputSchema,
				OBindArgsSchemas,
				Metadata,
				Ctx,
				ShapedErrors
			>,
		});
	}

	/**
	 * Define the output data validation schema for the action.
	 * @param schema Output data validation schema
	 *
	 * {@link https://next-safe-action.dev/docs/define-actions/create-the-client#outputschema See docs for more information}
	 */
	outputSchema<OOS extends StandardSchemaV1>(dataSchema: OOS) {
		return new SafeActionClient({
			...this.#args,
			outputSchema: dataSchema,
		});
	}

	/**
	 * Define the action.
	 * @param serverCodeFn Code that will be executed on the **server side**
	 * @param [cb] Optional callbacks that will be called after action execution, on the server.
	 *
	 * {@link https://next-safe-action.dev/docs/define-actions/instance-methods#action--stateaction See docs for more information}
	 */
	action<
		Data extends InferOutputOrDefault<OutputSchema, any>,
		Utils extends ActionCallbacks<
			ServerError,
			Metadata,
			Ctx,
			InputSchema,
			BindArgsSchemas,
			ShapedErrors,
			Data,
			PreValidationCtx
		> = ActionCallbacks<ServerError, Metadata, Ctx, InputSchema, BindArgsSchemas, ShapedErrors, Data, PreValidationCtx>,
	>(
		this: HasMetadata extends true
			? SafeActionClient<
					ServerError,
					ErrorsFormat,
					MetadataSchema,
					Metadata,
					HasMetadata,
					Ctx,
					InputSchemaFn,
					InputSchema,
					OutputSchema,
					BindArgsSchemas,
					ShapedErrors,
					ThrowsValidationErrors,
					HasValidatedMiddleware,
					PreValidationCtx
				>
			: never,
		serverCodeFn: ServerCodeFn<Metadata, Ctx, InputSchema, BindArgsSchemas, Data>,
		utils?: Utils
	): MaybeBrandThrows<
		SafeActionFn<ServerError, InputSchema, BindArgsSchemas, ShapedErrors, Data>,
		EffectiveThrows<ThrowsValidationErrors, Utils>
	> {
		return actionBuilder(this.#args).action(serverCodeFn, utils) as MaybeBrandThrows<
			SafeActionFn<ServerError, InputSchema, BindArgsSchemas, ShapedErrors, Data>,
			EffectiveThrows<ThrowsValidationErrors, Utils>
		>;
	}

	/**
	 * Define the stateful action.
	 * To be used with the [`useStateAction`](https://next-safe-action.dev/docs/execute-actions/hooks/usestateaction) hook.
	 * @param serverCodeFn Code that will be executed on the **server side**
	 * @param [cb] Optional callbacks that will be called after action execution, on the server.
	 *
	 * {@link https://next-safe-action.dev/docs/define-actions/instance-methods#action--stateaction See docs for more information}
	 */
	stateAction<
		Data extends InferOutputOrDefault<OutputSchema, any>,
		Utils extends ActionCallbacks<
			ServerError,
			Metadata,
			Ctx,
			InputSchema,
			BindArgsSchemas,
			ShapedErrors,
			Data,
			PreValidationCtx
		> = ActionCallbacks<ServerError, Metadata, Ctx, InputSchema, BindArgsSchemas, ShapedErrors, Data, PreValidationCtx>,
	>(
		this: HasMetadata extends true
			? SafeActionClient<
					ServerError,
					ErrorsFormat,
					MetadataSchema,
					Metadata,
					HasMetadata,
					Ctx,
					InputSchemaFn,
					InputSchema,
					OutputSchema,
					BindArgsSchemas,
					ShapedErrors,
					ThrowsValidationErrors,
					HasValidatedMiddleware,
					PreValidationCtx
				>
			: never,
		serverCodeFn: StatefulServerCodeFn<ServerError, Metadata, Ctx, InputSchema, BindArgsSchemas, ShapedErrors, Data>,
		utils?: Utils
	): MaybeBrandThrows<
		SafeStateActionFn<ServerError, InputSchema, BindArgsSchemas, ShapedErrors, Data>,
		EffectiveThrows<ThrowsValidationErrors, Utils>
	> {
		return actionBuilder(this.#args).stateAction(serverCodeFn, utils) as MaybeBrandThrows<
			SafeStateActionFn<ServerError, InputSchema, BindArgsSchemas, ShapedErrors, Data>,
			EffectiveThrows<ThrowsValidationErrors, Utils>
		>;
	}
}
