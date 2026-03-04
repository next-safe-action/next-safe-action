import { deepmerge } from "deepmerge-ts";
import type {} from "zod";
import type {
	DVES,
	MiddlewareResult,
	SafeActionClientArgs,
	SafeActionFn,
	SafeActionResult,
	SafeActionUtils,
	SafeStateActionFn,
	ServerCodeFn,
	StateServerCodeFn,
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
	ODVES extends DVES | undefined, // override default validation errors shape
	MetadataSchema extends StandardSchemaV1 | undefined = undefined,
	MD = InferOutputOrDefault<MetadataSchema, undefined>, // metadata type (inferred from metadata schema)
	Ctx extends object = {},
	ISF extends ((clientInput?: unknown) => Promise<StandardSchemaV1>) | undefined = undefined, // input schema function
	IS extends StandardSchemaV1 | undefined = ISF extends Function ? Awaited<ReturnType<ISF>> : undefined, // input schema
	OS extends StandardSchemaV1 | undefined = undefined, // output schema
	const BAS extends readonly StandardSchemaV1[] = [],
	CVE = undefined,
>(args: SafeActionClientArgs<ServerError, ODVES, MetadataSchema, MD, true, Ctx, ISF, IS, OS, BAS, CVE>) {
	const bindArgsSchemas = args.bindArgsSchemas ?? [];

	function buildAction({ withState }: { withState: false }): {
		action: <Data extends InferOutputOrDefault<OS, any>>(
			serverCodeFn: ServerCodeFn<MD, Ctx, IS, BAS, Data>,
			utils?: SafeActionUtils<ServerError, MD, Ctx, IS, BAS, CVE, Data>
		) => SafeActionFn<ServerError, IS, BAS, CVE, Data>;
	};
	function buildAction({ withState }: { withState: true }): {
		action: <Data extends InferOutputOrDefault<OS, any>>(
			serverCodeFn: StateServerCodeFn<ServerError, MD, Ctx, IS, BAS, CVE, Data>,
			utils?: SafeActionUtils<ServerError, MD, Ctx, IS, BAS, CVE, Data>
		) => SafeStateActionFn<ServerError, IS, BAS, CVE, Data>;
	};
	function buildAction({ withState }: { withState: boolean }) {
		return {
			action: <Data extends InferOutputOrDefault<OS, any>>(
				serverCodeFn:
					| ServerCodeFn<MD, Ctx, IS, BAS, Data>
					| StateServerCodeFn<ServerError, MD, Ctx, IS, BAS, CVE, Data>,
				utils?: SafeActionUtils<ServerError, MD, Ctx, IS, BAS, CVE, Data>
			) => {
				return async (...clientInputs: unknown[]) => {
					let currentCtx: object = {};
					const middlewareResult: MiddlewareResult<ServerError, object> = { success: false };
					type PrevResult = SafeActionResult<ServerError, IS, CVE, Data>;
					let prevResult: PrevResult = {};
					const frameworkErrorHandler = new FrameworkErrorHandler();

					// Track if server error has been handled.
					let serverErrorHandled = false;

					if (withState) {
						// Previous state is placed between bind args and main arg inputs, so it's always at the index of
						// the bind args schemas + 1. Get it and remove it from the client inputs array.
						prevResult = clientInputs.splice(bindArgsSchemas.length, 1)[0] as PrevResult;
					}

					// Extract structured inputs based on schema definitions rather than iterating over
					// clientInputs, so that excess arguments from external callers are silently ignored
					// — just like a plain function would. This keeps the wrapper transparent to its
					// intended signature.
					const mainClientInput = clientInputs[bindArgsSchemas.length] as InferInputOrDefault<IS, undefined>;
					const bindArgsClientInputs = clientInputs.slice(0, bindArgsSchemas.length) as InferInputArray<BAS>;

					// Execute the middleware stack.
					const executeMiddlewareStack = async (idx = 0) => {
						if (frameworkErrorHandler.error) {
							return;
						}

						const middlewareFn = args.middlewareFns[idx];
						middlewareResult.ctx = currentCtx;

						try {
							if (idx === 0) {
								if (args.metadataSchema) {
									// Validate metadata input.
									const parsedMd = await standardParse(args.metadataSchema, args.metadata);

									if (parsedMd.issues) {
										throw new ActionMetadataValidationError<MetadataSchema>(buildValidationErrors(parsedMd.issues));
									}
								}
							}

							// Middleware function.
							if (middlewareFn) {
								await middlewareFn({
									clientInput: mainClientInput as unknown, // pass raw client input
									bindArgsClientInputs: bindArgsClientInputs as unknown[],
									ctx: currentCtx,
									metadata: args.metadata,
									next: async (nextOpts) => {
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
								// Action function.
							} else {
								// Validate bind args inputs by iterating over schemas.
								const parsedBindArgsResults = await Promise.all(
									bindArgsSchemas.map((schema, i) => standardParse(schema, bindArgsClientInputs[i]))
								);

								// Validate main input.
								const parsedMainInputResult =
									typeof args.inputSchemaFn === "undefined"
										? ({
												value: undefined,
											} as const satisfies StandardSchemaV1.Result<undefined>)
										: await standardParse(await args.inputSchemaFn(mainClientInput), mainClientInput);

								let hasBindValidationErrors = false;

								// Initialize the bind args validation errors array.
								const bindArgsValidationErrors = Array(bindArgsSchemas.length).fill({});

								// Process bind args validation results.
								const parsedBindArgsInputs: any[] = [];

								for (let i = 0; i < parsedBindArgsResults.length; i++) {
									const parsedInput = parsedBindArgsResults[i]!;

									if (!parsedInput.issues) {
										parsedBindArgsInputs.push(parsedInput.value);
									} else {
										bindArgsValidationErrors[i] = buildValidationErrors<BAS[number]>(parsedInput.issues);
										hasBindValidationErrors = true;
									}
								}

								// Process main input validation result.
								let parsedMainInput: any = undefined;

								if (!parsedMainInputResult.issues) {
									parsedMainInput = parsedMainInputResult.value;
								} else {
									const validationErrors = buildValidationErrors<IS>(parsedMainInputResult.issues);

									middlewareResult.validationErrors = await Promise.resolve(
										args.handleValidationErrorsShape(validationErrors, {
											clientInput: mainClientInput,
											bindArgsClientInputs,
											ctx: currentCtx as Ctx,
											metadata: args.metadata,
										})
									);
								}

								// If there are bind args validation errors, throw an error.
								if (hasBindValidationErrors) {
									throw new ActionBindArgsValidationError(bindArgsValidationErrors);
								}

								if (middlewareResult.validationErrors) {
									return;
								}

								// @ts-expect-error
								const scfArgs: Parameters<StateServerCodeFn<ServerError, MD, Ctx, IS, BAS, CVE, Data>> = [];

								// Server code function always has this object as the first argument.
								scfArgs[0] = {
									parsedInput: parsedMainInput as InferOutputOrDefault<IS, undefined>,
									bindArgsParsedInputs: parsedBindArgsInputs as InferOutputArray<BAS>,
									clientInput: mainClientInput,
									bindArgsClientInputs,
									ctx: currentCtx as Ctx,
									metadata: args.metadata,
								};

								// If this action is stateful, server code function also has a `prevResult` property inside the second
								// argument object.
								if (withState) {
									scfArgs[1] = { prevResult: structuredClone(prevResult) };
								}

								const data = await serverCodeFn(...scfArgs).catch((e) => frameworkErrorHandler.handleError(e));

								// If a `outputSchema` is passed, validate the action return value.
								if (typeof args.outputSchema !== "undefined" && !frameworkErrorHandler.error) {
									const parsedData = await standardParse(args.outputSchema, data);

									if (parsedData.issues) {
										throw new ActionOutputDataValidationError<OS>(buildValidationErrors(parsedData.issues));
									}
								}

								if (frameworkErrorHandler.error) {
									middlewareResult.success = false;
									middlewareResult.navigationKind = FrameworkErrorHandler.getNavigationKind(
										frameworkErrorHandler.error
									);
								} else {
									middlewareResult.success = true;
									middlewareResult.data = data;
								}

								middlewareResult.parsedInput = parsedMainInput;
								middlewareResult.bindArgsParsedInputs = parsedBindArgsInputs;
							}
						} catch (e: unknown) {
							// If error is `ActionServerValidationError`, return `validationErrors` as if schema validation would fail.
							// This check must come before `serverErrorHandled` guard so middleware catch blocks using
							// `returnValidationErrors` work even when `handleServerError` is configured to rethrow.
							if (e instanceof ActionServerValidationError) {
								const ve = e.validationErrors as ValidationErrors<IS>;
								middlewareResult.validationErrors = await Promise.resolve(
									args.handleValidationErrorsShape(ve, {
										clientInput: mainClientInput,
										bindArgsClientInputs,
										ctx: currentCtx as Ctx,
										metadata: args.metadata,
									})
								);
							} else {
								// Only handle server errors once. If already handled, rethrow to bubble up.
								if (serverErrorHandled) {
									throw e;
								}
								// Mark that we're handling the server error to prevent multiple calls.
								serverErrorHandled = true;

								// If error is not an instance of Error, wrap it in an Error object with
								// the default message.
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
						}
					};

					// Execute middleware chain + action function.
					await executeMiddlewareStack();

					const callbackPromises: (Promise<unknown> | undefined)[] = [];

					// If an internal (navigation) framework error occurred, throw it, so it will be processed by Next.js.
					if (frameworkErrorHandler.error) {
						callbackPromises.push(
							utils?.onNavigation?.({
								metadata: args.metadata,
								ctx: currentCtx as Ctx,
								clientInput: mainClientInput,
								bindArgsClientInputs,
								navigationKind: FrameworkErrorHandler.getNavigationKind(frameworkErrorHandler.error),
							})
						);

						callbackPromises.push(
							utils?.onSettled?.({
								metadata: args.metadata,
								ctx: currentCtx as Ctx,
								clientInput: mainClientInput,
								bindArgsClientInputs,
								result: {},
								navigationKind: FrameworkErrorHandler.getNavigationKind(frameworkErrorHandler.error),
							})
						);

						await Promise.all(callbackPromises);

						throw frameworkErrorHandler.error;
					}

					const actionResult: SafeActionResult<ServerError, IS, CVE, Data> = {};

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
								middlewareResult.validationErrors as CVE,
								await overrideErrorMessageFn?.(middlewareResult.validationErrors as CVE)
							);
						} else {
							actionResult.validationErrors = middlewareResult.validationErrors as CVE;
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
								parsedInput: middlewareResult.parsedInput as InferOutputOrDefault<IS, undefined>,
								bindArgsParsedInputs: middlewareResult.bindArgsParsedInputs as InferOutputArray<BAS>,
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
