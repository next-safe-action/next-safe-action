import { actionBuilder } from "./action-builder";
import type {
	DVES,
	InputSchemaFactoryFn,
	MiddlewareFn,
	SafeActionClientArgs,
	SafeActionUtils,
	ServerCodeFn,
	StateServerCodeFn,
} from "./index.types";
import type { InferOutputOrDefault, StandardSchemaV1 } from "./standard-schema";
import { isStandardSchema } from "./standard-schema";
import type {
	FlattenedValidationErrors,
	HandleValidationErrorsShapeFn,
	ValidationErrors,
} from "./validation-errors.types";

export class SafeActionClient<
	ServerError,
	ODVES extends DVES | undefined, // override default validation errors shape
	MetadataSchema extends StandardSchemaV1 | undefined = undefined,
	MD = InferOutputOrDefault<MetadataSchema, undefined>, // metadata type (inferred from metadata schema)
	MDProvided extends boolean = MetadataSchema extends undefined ? true : false,
	Ctx extends object = {},
	ISF extends ((clientInput?: unknown) => Promise<StandardSchemaV1>) | undefined = undefined, // input schema function
	IS extends StandardSchemaV1 | undefined = ISF extends Function ? Awaited<ReturnType<ISF>> : undefined, // input schema
	OS extends StandardSchemaV1 | undefined = undefined, // output schema
	const BAS extends readonly StandardSchemaV1[] = [],
	CVE = undefined,
> {
	readonly #args: SafeActionClientArgs<ServerError, ODVES, MetadataSchema, MD, MDProvided, Ctx, ISF, IS, OS, BAS, CVE>;

	constructor(
		args: SafeActionClientArgs<ServerError, ODVES, MetadataSchema, MD, MDProvided, Ctx, ISF, IS, OS, BAS, CVE>
	) {
		this.#args = args;
	}

	/**
	 * Use a middleware function.
	 * @param middlewareFn Middleware function
	 *
	 * {@link https://next-safe-action.dev/docs/define-actions/instance-methods#use See docs for more information}
	 */
	use<NextCtx extends object>(middlewareFn: MiddlewareFn<ServerError, MD, Ctx, Ctx & NextCtx>) {
		return new SafeActionClient({
			...this.#args,
			middlewareFns: [...this.#args.middlewareFns, middlewareFn],
			ctxType: {} as Ctx & NextCtx,
		});
	}

	/**
	 * Define metadata for the action.
	 * @param data Metadata with the same type as the return value of the [`defineMetadataSchema`](https://next-safe-action.dev/docs/define-actions/create-the-client#definemetadataschema) optional initialization function
	 *
	 * {@link https://next-safe-action.dev/docs/define-actions/instance-methods#metadata See docs for more information}
	 */
	metadata(data: MD) {
		return new SafeActionClient({
			...this.#args,
			metadata: data,
			metadataProvided: true,
		});
	}

	/**
	 * Define the input validation schema for the action.
	 * @param inputSchema Input validation schema
	 * @param utils Optional utils object
	 *
	 * {@link https://next-safe-action.dev/docs/define-actions/create-the-client#inputschema See docs for more information}
	 */
	inputSchema<
		OIS extends StandardSchemaV1 | InputSchemaFactoryFn<IS>, // override input schema
		AIS extends StandardSchemaV1 = OIS extends InputSchemaFactoryFn<IS, infer NextSchema> // actual input schema
			? NextSchema
			: OIS,
		// override custom validation errors shape
		OCVE = ODVES extends "flattened" ? FlattenedValidationErrors<ValidationErrors<AIS>> : ValidationErrors<AIS>,
	>(
		inputSchema: OIS,
		utils?: {
			handleValidationErrorsShape?: HandleValidationErrorsShapeFn<AIS, BAS, MD, Ctx, OCVE>;
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

						return (inputSchema as unknown as InputSchemaFactoryFn<IS, AIS>)(prevSchema as IS, {
							clientInput,
						});
					}
				: async () => inputSchema) as unknown as ISF,
			handleValidationErrorsShape: (utils?.handleValidationErrorsShape ??
				this.#args.handleValidationErrorsShape) as HandleValidationErrorsShapeFn<AIS, BAS, MD, Ctx, OCVE>,
		});
	}

	/**
	 * @deprecated Alias for `inputSchema` method. Use that instead.
	 */
	// oxlint-disable-next-line typescript/unbound-method
	schema = this.inputSchema;

	/**
	 * Define the bind args input validation schema for the action.
	 * @param bindArgsSchemas Bind args input validation schemas
	 *
	 * {@link https://next-safe-action.dev/docs/define-actions/instance-methods#bindargsschemas See docs for more information}
	 */
	bindArgsSchemas<const OBAS extends readonly StandardSchemaV1[]>(bindArgsSchemas: OBAS) {
		return new SafeActionClient({
			...this.#args,
			bindArgsSchemas,
			handleValidationErrorsShape: this.#args.handleValidationErrorsShape as unknown as HandleValidationErrorsShapeFn<
				IS,
				OBAS,
				MD,
				Ctx,
				CVE
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
	action<Data extends InferOutputOrDefault<OS, any>>(
		this: MDProvided extends true
			? SafeActionClient<ServerError, ODVES, MetadataSchema, MD, MDProvided, Ctx, ISF, IS, OS, BAS, CVE>
			: never,
		serverCodeFn: ServerCodeFn<MD, Ctx, IS, BAS, Data>,
		utils?: SafeActionUtils<ServerError, MD, Ctx, IS, BAS, CVE, Data>
	) {
		return actionBuilder(this.#args).action(serverCodeFn, utils);
	}

	/**
	 * Define the stateful action.
	 * To be used with the [`useStateAction`](https://next-safe-action.dev/docs/execute-actions/hooks/usestateaction) hook.
	 * @param serverCodeFn Code that will be executed on the **server side**
	 * @param [cb] Optional callbacks that will be called after action execution, on the server.
	 *
	 * {@link https://next-safe-action.dev/docs/define-actions/instance-methods#action--stateaction See docs for more information}
	 */
	stateAction<Data extends InferOutputOrDefault<OS, any>>(
		this: MDProvided extends true
			? SafeActionClient<ServerError, ODVES, MetadataSchema, MD, MDProvided, Ctx, ISF, IS, OS, BAS, CVE>
			: never,
		serverCodeFn: StateServerCodeFn<ServerError, MD, Ctx, IS, BAS, CVE, Data>,
		utils?: SafeActionUtils<ServerError, MD, Ctx, IS, BAS, CVE, Data>
	) {
		return actionBuilder(this.#args).stateAction(serverCodeFn, utils);
	}
}
