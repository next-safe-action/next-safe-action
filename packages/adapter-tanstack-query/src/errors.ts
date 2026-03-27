/**
 * Error thrown by the `mutationFn` inside `mutationOptions` when a safe action result
 * contains `serverError`, `validationErrors`, or both.
 *
 * This error is created entirely on the client side — it never crosses the server-client
 * boundary, so `instanceof` checks work reliably.
 */
export class ActionMutationError<ServerError, ShapedErrors> extends Error {
	readonly kind: "server" | "validation" | "both";
	readonly serverError?: ServerError;
	readonly validationErrors?: ShapedErrors;

	constructor(args: { serverError?: ServerError; validationErrors?: ShapedErrors }) {
		const parts: string[] = [];
		if (args.serverError !== undefined) parts.push("server error");
		if (args.validationErrors !== undefined) parts.push("validation errors");
		super(`Action mutation failed with ${parts.join(" and ")}`);

		this.name = "ActionMutationError";
		this.serverError = args.serverError;
		this.validationErrors = args.validationErrors;

		const hasServer = args.serverError !== undefined;
		const hasValidation = args.validationErrors !== undefined;
		this.kind = hasServer && hasValidation ? "both" : hasServer ? "server" : "validation";
	}
}

/**
 * Type guard to check if an unknown error is an `ActionMutationError`.
 */
export function isActionMutationError(error: unknown): error is ActionMutationError<unknown, unknown> {
	return error instanceof ActionMutationError;
}

/**
 * Type guard to check if an `ActionMutationError` contains a server error.
 * Narrows `serverError` from optional to required.
 */
export function hasServerError<ServerError, ShapedErrors>(
	error: ActionMutationError<ServerError, ShapedErrors>
): error is ActionMutationError<ServerError, ShapedErrors> & {
	serverError: ServerError;
	kind: "server" | "both";
} {
	return error.serverError !== undefined;
}

/**
 * Type guard to check if an `ActionMutationError` contains validation errors.
 * Narrows `validationErrors` from optional to required.
 */
export function hasValidationErrors<ServerError, ShapedErrors>(
	error: ActionMutationError<ServerError, ShapedErrors>
): error is ActionMutationError<ServerError, ShapedErrors> & {
	validationErrors: ShapedErrors;
	kind: "validation" | "both";
} {
	return error.validationErrors !== undefined;
}
