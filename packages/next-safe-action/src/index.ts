import type { CreateClientOpts, ValidationErrorsFormat, HandleServerErrorFn } from "./index.types";
import { FrameworkErrorHandler } from "./next/errors";
import { SafeActionClient } from "./safe-action-client";
import type { InferOutputOrDefault, StandardSchemaV1 } from "./standard-schema";
import { DEFAULT_SERVER_ERROR_MESSAGE } from "./utils";
import { flattenValidationErrors, formatValidationErrors } from "./validation-errors";

export { createMiddleware, createValidatedMiddleware } from "./middleware";
export { DEFAULT_SERVER_ERROR_MESSAGE } from "./utils";

/**
 * Detect Next.js navigation/framework errors (redirect, notFound, forbidden, unauthorized, etc.)
 * that must be re-thrown to let the framework handle them.
 */
export function isNavigationError(error: unknown): error is Error {
	return FrameworkErrorHandler.isNavigationError(error);
}
export {
	ActionBindArgsValidationError,
	ActionMetadataValidationError,
	ActionOutputDataValidationError,
	ActionValidationError,
	flattenValidationErrors,
	formatValidationErrors,
	returnValidationErrors,
} from "./validation-errors";

export type * from "./index.types";
export type * from "./validation-errors.types";

/**
 * Create a new safe action client.
 * Note: this client only works with Zod as the validation library.
 * @param createOpts Initialization options
 *
 * {@link https://next-safe-action.dev/docs/define-actions/create-the-client#initialization-options See docs for more information}
 */
export const createSafeActionClient = <
	ErrorsFormat extends ValidationErrorsFormat | undefined = undefined,
	ServerError = string,
	MetadataSchema extends StandardSchemaV1 | undefined = undefined,
	ThrowsValidationErrors extends boolean = false,
>(
	createOpts?: CreateClientOpts<ErrorsFormat, ServerError, MetadataSchema, ThrowsValidationErrors>
) => {
	// If `handleServerError` is provided, use it, otherwise default to log to console and generic error message.
	const handleServerError: HandleServerErrorFn<ServerError, MetadataSchema> =
		createOpts?.handleServerError ||
		((e) => {
			console.error("Action error:", e.message);
			return DEFAULT_SERVER_ERROR_MESSAGE as ServerError;
		});

	return new SafeActionClient({
		middlewareFns: [async ({ next }) => next({ ctx: {} })],
		validatedMiddlewareFns: [],
		handleServerError,
		inputSchemaFn: undefined,
		bindArgsSchemas: [],
		outputSchema: undefined,
		ctxType: {},
		preValidationCtxType: {},
		metadataSchema: (createOpts?.defineMetadataSchema?.() ?? undefined) as MetadataSchema,
		metadata: undefined as InferOutputOrDefault<MetadataSchema, undefined>,
		defaultValidationErrorsShape: (createOpts?.defaultValidationErrorsShape ?? "formatted") as ErrorsFormat,
		throwValidationErrors: (createOpts?.throwValidationErrors ?? false) as ThrowsValidationErrors,
		handleValidationErrorsShape: async (ve) =>
			createOpts?.defaultValidationErrorsShape === "flattened"
				? flattenValidationErrors(ve)
				: formatValidationErrors(ve),
	});
};
