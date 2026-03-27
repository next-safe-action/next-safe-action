import { deepmerge } from "deepmerge-ts";
import type {} from "zod";
import type {
	ValidationErrorsFormat,
	MiddlewareResult,
	SafeActionClientArgs,
	SafeActionFn,
	SafeActionResult,
	ActionCallbacks,
	SafeStateActionFn,
	ServerCodeFn,
	StatefulServerCodeFn,
} from "./index.types";
import { FrameworkErrorHandler } from "./next/errors";
import type {
	InferInputArray,
	InferInputOrDefault,
	InferOutputArray,
	InferOutputOrDefault,
	StandardSchemaV1,
} from "./standard-schema";
import { standardParse } from "./standard-schema";
import { DEFAULT_SERVER_ERROR_MESSAGE, isError, winningBoolean } from "./utils";
import {
	ActionBindArgsValidationError,
	ActionMetadataValidationError,
	ActionOutputDataValidationError,
	ActionServerValidationError,
	ActionValidationError,
	buildValidationErrors,
} from "./validation-errors";
import type { ValidationErrors } from "./validation-errors.types";

export function actionBuilder<
	ServerError,
	ErrorsFormat extends ValidationErrorsFormat | undefined, // override default validation errors shape
	MetadataSchema extends StandardSchemaV1 | undefined = undefined,
	Metadata = InferOutputOrDefault<MetadataSchema, undefined>, // metadata type (inferred from metadata schema)
	Ctx extends object = {},
	InputSchemaFn extends ((clientInput?: unknown) => Promise<StandardSchemaV1>) | undefined = undefined, // input schema function
	InputSchema extends StandardSchemaV1 | undefined = InputSchemaFn extends Function ? Awaited<ReturnType<InputSchemaFn>> : undefined, // input schema
	OutputSchema extends StandardSchemaV1 | undefined = undefined, // output schema
	const BindArgsSchemas extends readonly StandardSchemaV1[] = [],
	ShapedErrors = undefined,
>(args: SafeActionClientArgs<ServerError, ErrorsFormat, MetadataSchema, Metadata, true, Ctx, InputSchemaFn, InputSchema, OutputSchema, BindArgsSchemas, ShapedErrors>) {
	const bindArgsSchemas = args.bindArgsSchemas ?? [];

	// ─── Validate metadata schema ────────────────────────────────────────

	async function validateMetadata() {
		if (!args.metadataSchema) return;

		const parsedMd = await standardParse(args.metadataSchema, args.metadata);

		if (parsedMd.issues) {
			throw new ActionMetadataValidationError<MetadataSchema>(buildValidationErrors(parsedMd.issues));
		}
	}

	// ─── Validate bind args and main input ───────────────────────────────
	// Returns parsed inputs on success, or null if validation errors were set on middlewareResult.

	async function validateInputs(
		mainClientInput: InferInputOrDefault<InputSchema, undefined>,
		bindArgsClientInputs: InferInputArray<BindArgsSchemas>,
		currentCtx: object,
		middlewareResult: MiddlewareResult<ServerError, object>
	): Promise<{ parsedMainInput: unknown; parsedBindArgsInputs: unknown[] } | null> {
		const parsedBindArgsResults = await Promise.all(
			bindArgsSchemas.map((schema, i) => standardParse(schema, bindArgsClientInputs[i]))
		);

		const parsedMainInputResult =
			typeof args.inputSchemaFn === "undefined"
				? ({ value: undefined } as const satisfies StandardSchemaV1.Result<undefined>)
				: await standardParse(await args.inputSchemaFn(mainClientInput), mainClientInput);

		// Process bind args validation results.
		let hasBindValidationErrors = false;
		const bindArgsValidationErrors = Array(bindArgsSchemas.length).fill({});
		const parsedBindArgsInputs: unknown[] = [];

		for (let i = 0; i < parsedBindArgsResults.length; i++) {
			const parsedInput = parsedBindArgsResults[i]!;

			if (!parsedInput.issues) {
				parsedBindArgsInputs.push(parsedInput.value);
			} else {
				bindArgsValidationErrors[i] = buildValidationErrors<BindArgsSchemas[number]>(parsedInput.issues);
				hasBindValidationErrors = true;
			}
		}

		// Process main input validation result.
		let parsedMainInput: unknown = undefined;

		if (!parsedMainInputResult.issues) {
			parsedMainInput = parsedMainInputResult.value;
		} else {
			const validationErrors = buildValidationErrors<InputSchema>(parsedMainInputResult.issues);

			middlewareResult.validationErrors = await Promise.resolve(
				args.handleValidationErrorsShape(validationErrors, {
					clientInput: mainClientInput,
					bindArgsClientInputs,
					ctx: currentCtx as Ctx,
					metadata: args.metadata,
				})
			);
		}

		// Bind args errors are thrown (caught by the middleware stack's error handler).
		if (hasBindValidationErrors) {
			throw new ActionBindArgsValidationError(bindArgsValidationErrors);
		}

		// Main input validation errors cause early return (no server code execution).
		if (middlewareResult.validationErrors) {
			return null;
		}

		return { parsedMainInput, parsedBindArgsInputs };
	}

	// ─── Execute server code with output validation ──────────────────────

	async function executeServerCode(
		serverCodeFn: ServerCodeFn<Metadata, Ctx, InputSchema, BindArgsSchemas, any> | StatefulServerCodeFn<ServerError, Metadata, Ctx, InputSchema, BindArgsSchemas, ShapedErrors, any>,
		mainClientInput: InferInputOrDefault<InputSchema, undefined>,
		bindArgsClientInputs: InferInputArray<BindArgsSchemas>,
		currentCtx: object,
		middlewareResult: MiddlewareResult<ServerError, object>,
		frameworkErrorHandler: FrameworkErrorHandler,
		withState: boolean,
		prevResult: SafeActionResult<ServerError, InputSchema, ShapedErrors, any>
	) {
		const validated = await validateInputs(mainClientInput, bindArgsClientInputs, currentCtx, middlewareResult);

		// Validation errors were set — skip server code execution.
		if (!validated) return;

		const { parsedMainInput, parsedBindArgsInputs } = validated;

		// Build server code function arguments.
		const serverCodeArgs: unknown[] = [
			{
				parsedInput: parsedMainInput as InferOutputOrDefault<InputSchema, undefined>,
				bindArgsParsedInputs: parsedBindArgsInputs as InferOutputArray<BindArgsSchemas>,
				clientInput: mainClientInput,
				bindArgsClientInputs,
				ctx: currentCtx as Ctx,
				metadata: args.metadata,
			},
		];

		if (withState) {
			serverCodeArgs.push({ prevResult: structuredClone(prevResult) });
		}

		const data = await (serverCodeFn as (...a: unknown[]) => Promise<unknown>)(...serverCodeArgs).catch((e) =>
			frameworkErrorHandler.handleError(e)
		);

		// Validate output schema if provided.
		if (typeof args.outputSchema !== "undefined" && !frameworkErrorHandler.error) {
			const parsedData = await standardParse(args.outputSchema, data);

			if (parsedData.issues) {
				throw new ActionOutputDataValidationError<OutputSchema>(buildValidationErrors(parsedData.issues));
			}
		}

		// Update middleware result based on execution outcome.
		if (frameworkErrorHandler.error) {
			middlewareResult.success = false;
			middlewareResult.navigationKind = FrameworkErrorHandler.getNavigationKind(frameworkErrorHandler.error);
		} else {
			middlewareResult.success = true;
			middlewareResult.data = data;
		}

		middlewareResult.parsedInput = parsedMainInput;
		middlewareResult.bindArgsParsedInputs = parsedBindArgsInputs;
	}

	// ─── Handle errors from middleware/action execution ──────────────────

	async function handleExecutionError(
		e: unknown,
		mainClientInput: InferInputOrDefault<InputSchema, undefined>,
		bindArgsClientInputs: InferInputArray<BindArgsSchemas>,
		currentCtx: object,
		middlewareResult: MiddlewareResult<ServerError, object>,
		serverErrorHandled: { value: boolean }
	) {
		// ActionServerValidationError: treat as if schema validation failed.
		// This check must come before the serverErrorHandled guard so middleware catch blocks
		// using `returnValidationErrors` work even when handleServerError is configured to rethrow.
		if (e instanceof ActionServerValidationError) {
			const ve = e.validationErrors as ValidationErrors<InputSchema>;

			middlewareResult.validationErrors = await Promise.resolve(
				args.handleValidationErrorsShape(ve, {
					clientInput: mainClientInput,
					bindArgsClientInputs,
					ctx: currentCtx as Ctx,
					metadata: args.metadata,
				})
			);
			return;
		}

		// Only handle server errors once. If already handled, rethrow to bubble up.
		if (serverErrorHandled.value) {
			throw e;
		}
		serverErrorHandled.value = true;

		const error = isError(e) ? e : new Error(DEFAULT_SERVER_ERROR_MESSAGE);
		const returnedError = await Promise.resolve(
			args.handleServerError(error, {
				clientInput: mainClientInput as unknown, // pass raw client input
				bindArgsClientInputs: bindArgsClientInputs as unknown[],
				ctx: currentCtx,
				metadata: args.metadata as InferOutputOrDefault<MetadataSchema, undefined>,
			})
		);

		middlewareResult.serverError = returnedError;
	}

	// ─── Build action result and run callbacks ───────────────────────────

	async function buildResultAndRunCallbacks<Data>(
		middlewareResult: MiddlewareResult<ServerError, object>,
		frameworkErrorHandler: FrameworkErrorHandler,
		mainClientInput: InferInputOrDefault<InputSchema, undefined>,
		bindArgsClientInputs: InferInputArray<BindArgsSchemas>,
		currentCtx: object,
		utils?: ActionCallbacks<ServerError, Metadata, Ctx, InputSchema, BindArgsSchemas, ShapedErrors, Data>
	): Promise<SafeActionResult<ServerError, InputSchema, ShapedErrors, Data>> {
		const callbackPromises: (Promise<unknown> | undefined)[] = [];

		// If a navigation framework error occurred, run navigation callbacks then rethrow
		// so Next.js can process it.
		if (frameworkErrorHandler.error) {
			const navigationKind = FrameworkErrorHandler.getNavigationKind(frameworkErrorHandler.error);

			callbackPromises.push(
				utils?.onNavigation?.({
					metadata: args.metadata,
					ctx: currentCtx as Ctx,
					clientInput: mainClientInput,
					bindArgsClientInputs,
					navigationKind,
				})
			);

			callbackPromises.push(
				utils?.onSettled?.({
					metadata: args.metadata,
					ctx: currentCtx as Ctx,
					clientInput: mainClientInput,
					bindArgsClientInputs,
					result: {},
					navigationKind,
				})
			);

			await Promise.all(callbackPromises);
			throw frameworkErrorHandler.error;
		}

		// Build the action result.
		const actionResult: SafeActionResult<ServerError, InputSchema, ShapedErrors, Data> = {};

		if (typeof middlewareResult.validationErrors !== "undefined") {
			// `utils.throwValidationErrors` has higher priority since it's set at the action level.
			// It overrides the client setting, if set.
			if (
				winningBoolean(
					args.throwValidationErrors,
					typeof utils?.throwValidationErrors === "undefined" ? undefined : Boolean(utils.throwValidationErrors)
				)
			) {
				const overrideErrorMessageFn =
					typeof utils?.throwValidationErrors === "object" && utils?.throwValidationErrors.overrideErrorMessage
						? utils?.throwValidationErrors.overrideErrorMessage
						: undefined;

				throw new ActionValidationError(
					middlewareResult.validationErrors as ShapedErrors,
					await overrideErrorMessageFn?.(middlewareResult.validationErrors as ShapedErrors)
				);
			} else {
				actionResult.validationErrors = middlewareResult.validationErrors as ShapedErrors;
			}
		}

		if (typeof middlewareResult.serverError !== "undefined") {
			if (utils?.throwServerError) {
				throw middlewareResult.serverError;
			} else {
				actionResult.serverError = middlewareResult.serverError;
			}
		}

		if (middlewareResult.success) {
			if (typeof middlewareResult.data !== "undefined") {
				actionResult.data = middlewareResult.data as Data;
			}

			callbackPromises.push(
				utils?.onSuccess?.({
					metadata: args.metadata,
					ctx: currentCtx as Ctx,
					data: actionResult.data as Data,
					clientInput: mainClientInput,
					bindArgsClientInputs,
					parsedInput: middlewareResult.parsedInput as InferOutputOrDefault<InputSchema, undefined>,
					bindArgsParsedInputs: middlewareResult.bindArgsParsedInputs as InferOutputArray<BindArgsSchemas>,
				})
			);
		} else {
			callbackPromises.push(
				utils?.onError?.({
					metadata: args.metadata,
					ctx: currentCtx as Ctx,
					clientInput: mainClientInput,
					bindArgsClientInputs,
					error: actionResult,
				})
			);
		}

		// onSettled, if provided, is always executed.
		callbackPromises.push(
			utils?.onSettled?.({
				metadata: args.metadata,
				ctx: currentCtx as Ctx,
				clientInput: mainClientInput,
				bindArgsClientInputs,
				result: actionResult,
			})
		);

		await Promise.all(callbackPromises);

		return actionResult;
	}

	// ─── Action builder ──────────────────────────────────────────────────

	function buildAction({ withState }: { withState: false }): {
		action: <Data extends InferOutputOrDefault<OutputSchema, any>>(
			serverCodeFn: ServerCodeFn<Metadata, Ctx, InputSchema, BindArgsSchemas, Data>,
			utils?: ActionCallbacks<ServerError, Metadata, Ctx, InputSchema, BindArgsSchemas, ShapedErrors, Data>
		) => SafeActionFn<ServerError, InputSchema, BindArgsSchemas, ShapedErrors, Data>;
	};
	function buildAction({ withState }: { withState: true }): {
		action: <Data extends InferOutputOrDefault<OutputSchema, any>>(
			serverCodeFn: StatefulServerCodeFn<ServerError, Metadata, Ctx, InputSchema, BindArgsSchemas, ShapedErrors, Data>,
			utils?: ActionCallbacks<ServerError, Metadata, Ctx, InputSchema, BindArgsSchemas, ShapedErrors, Data>
		) => SafeStateActionFn<ServerError, InputSchema, BindArgsSchemas, ShapedErrors, Data>;
	};
	function buildAction({ withState }: { withState: boolean }) {
		return {
			action: <Data extends InferOutputOrDefault<OutputSchema, any>>(
				serverCodeFn:
					| ServerCodeFn<Metadata, Ctx, InputSchema, BindArgsSchemas, Data>
					| StatefulServerCodeFn<ServerError, Metadata, Ctx, InputSchema, BindArgsSchemas, ShapedErrors, Data>,
				utils?: ActionCallbacks<ServerError, Metadata, Ctx, InputSchema, BindArgsSchemas, ShapedErrors, Data>
			) => {
				return async (...clientInputs: unknown[]) => {
					let currentCtx: object = {};
					const middlewareResult: MiddlewareResult<ServerError, object> = { success: false };
					type PrevResult = SafeActionResult<ServerError, InputSchema, ShapedErrors, Data>;
					let prevResult: PrevResult = {};
					const frameworkErrorHandler = new FrameworkErrorHandler();
					const serverErrorHandled = { value: false };

					// Extract prevResult for stateful actions.
					if (withState) {
						prevResult = clientInputs.splice(bindArgsSchemas.length, 1)[0] as PrevResult;
					}

					// Extract structured inputs based on schema definitions rather than iterating over
					// clientInputs, so that excess arguments from external callers are silently ignored.
					const mainClientInput = clientInputs[bindArgsSchemas.length] as InferInputOrDefault<InputSchema, undefined>;
					const bindArgsClientInputs = clientInputs.slice(0, bindArgsSchemas.length) as InferInputArray<BindArgsSchemas>;

					// Validate metadata once, before running the middleware stack.
					try {
						await validateMetadata();
					} catch (e: unknown) {
						await handleExecutionError(
							e,
							mainClientInput,
							bindArgsClientInputs,
							currentCtx,
							middlewareResult,
							serverErrorHandled
						);

						return buildResultAndRunCallbacks<Data>(
							middlewareResult,
							frameworkErrorHandler,
							mainClientInput,
							bindArgsClientInputs,
							currentCtx,
							utils
						);
					}

					// Execute the middleware stack recursively.
					const executeMiddlewareStack = async (idx = 0) => {
						if (frameworkErrorHandler.error) return;

						const middlewareFn = args.middlewareFns[idx];
						middlewareResult.ctx = currentCtx;

						try {
							if (middlewareFn) {
								let nextCalled = false;

								await middlewareFn({
									clientInput: mainClientInput as unknown, // pass raw client input
									bindArgsClientInputs: bindArgsClientInputs as unknown[],
									ctx: currentCtx,
									metadata: args.metadata,
									next: async (nextOpts) => {
										if (nextCalled) {
											throw new Error(
												"next() called multiple times in middleware. Each middleware must call next() at most once."
											);
										}
										nextCalled = true;

										currentCtx = deepmerge(currentCtx, nextOpts?.ctx ?? {});
										await executeMiddlewareStack(idx + 1);
										return middlewareResult;
									},
								}).catch((e) => {
									frameworkErrorHandler.handleError(e);
									if (frameworkErrorHandler.error) {
										middlewareResult.success = false;
										middlewareResult.navigationKind = FrameworkErrorHandler.getNavigationKind(
											frameworkErrorHandler.error
										);
									}
								});
							} else {
								// Terminal case: validate inputs and execute server code.
								await executeServerCode(
									serverCodeFn,
									mainClientInput,
									bindArgsClientInputs,
									currentCtx,
									middlewareResult,
									frameworkErrorHandler,
									withState,
									prevResult
								);
							}
						} catch (e: unknown) {
							await handleExecutionError(
								e,
								mainClientInput,
								bindArgsClientInputs,
								currentCtx,
								middlewareResult,
								serverErrorHandled
							);
						}
					};

					// Execute middleware chain + action function.
					await executeMiddlewareStack();

					return buildResultAndRunCallbacks<Data>(
						middlewareResult,
						frameworkErrorHandler,
						mainClientInput,
						bindArgsClientInputs,
						currentCtx,
						utils
					);
				};
			},
		};
	}

	return {
		/**
		 * Define the action.
		 * @param serverCodeFn Code that will be executed on the **server side**
		 *
		 * {@link https://next-safe-action.dev/docs/define-actions/instance-methods#action--stateaction See docs for more information}
		 */
		action: buildAction({ withState: false }).action,

		/**
		 * Define the stateful action. To be used with the [`useStateAction`](https://next-safe-action.dev/docs/execute-actions/hooks/usestateaction) hook.
		 * @param serverCodeFn Code that will be executed on the **server side**
		 *
		 * {@link https://next-safe-action.dev/docs/define-actions/instance-methods#action--stateaction See docs for more information}
		 */
		stateAction: buildAction({ withState: true }).action,
	};
}
