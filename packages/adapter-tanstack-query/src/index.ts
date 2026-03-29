import { isNavigationError } from "next-safe-action";
import type { SingleInputActionFn } from "next-safe-action/hooks";
import { ActionMutationError } from "./errors";
import type { MutationOptionsOpts, MutationOptionsReturn } from "./index.types";
import type { InferInputOrDefault, StandardSchemaV1 } from "./standard-schema";

/**
 * Creates a complete `UseMutationOptions` object for use with TanStack Query's
 * `useMutation` hook, wired to a next-safe-action safe action function.
 *
 * The returned `mutationFn`:
 * 1. Calls the safe action with the provided input
 * 2. Checks the result for `serverError` / `validationErrors`
 * 3. Throws `ActionMutationError` if errors are present
 * 4. Returns `data` on success
 *
 * Navigation errors (`redirect()`, `notFound()`, etc.) are automatically propagated
 * to Next.js via TanStack Query's `throwOnError` mechanism, they are re-thrown during
 * React's render phase so the framework can handle navigation.
 *
 * **Important:** Do not use `throwValidationErrors` or `throwServerError` on actions
 * passed to this function. React's Flight protocol serializes thrown errors into plain
 * `Error` objects, losing all structured data. The result envelope (default behavior) is
 * the only reliable channel for structured error data.
 *
 * @param safeActionFn The safe action function to wrap.
 * @param opts Optional TanStack Query mutation options (all except `mutationFn`).
 * @returns A complete `UseMutationOptions` object ready to pass to `useMutation`.
 *
 * @example
 * ```typescript
 * const mutation = useMutation(mutationOptions(myAction));
 * const mutation = useMutation(mutationOptions(myAction, { onSuccess: (data) => ... }));
 * ```
 */
export function mutationOptions<
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
	TOnMutateResult = unknown,
>(
	safeActionFn: SingleInputActionFn<ServerError, Schema, ShapedErrors, Data>,
	opts?: MutationOptionsOpts<ServerError, Schema, ShapedErrors, Data, TOnMutateResult>
): MutationOptionsReturn<ServerError, Schema, ShapedErrors, Data, TOnMutateResult> {
	// Capture user's throwOnError and retry before spreading opts, so we can
	// compose them with navigation error detection.
	const userThrowOnError = opts?.throwOnError;
	const userRetry = opts?.retry;

	return {
		...opts,
		// Compose throwOnError: always propagate navigation errors (redirect, notFound,
		// forbidden, unauthorized) to Next.js via React's render-phase error propagation,
		// while preserving the user's throwOnError behavior for all other errors.
		throwOnError: (error) => {
			if (isNavigationError(error)) return true;
			if (typeof userThrowOnError === "function") return userThrowOnError(error);
			return userThrowOnError ?? false;
		},
		// Compose retry: never retry navigation errors (they are control-flow signals,
		// not retryable failures), while preserving the user's retry behavior for all
		// other errors.
		retry: (failureCount, error) => {
			if (isNavigationError(error)) return false;
			if (typeof userRetry === "function") return userRetry(failureCount, error);
			if (typeof userRetry === "number") return failureCount < userRetry;
			return userRetry ?? false;
		},
		mutationFn: async (input: InferInputOrDefault<Schema, void>, _context) => {
			const result = await safeActionFn(input as InferInputOrDefault<Schema, undefined>);

			// Check the result envelope for errors, the only reliable path for
			// structured error data across the server-client boundary.
			if (result.serverError !== undefined || result.validationErrors !== undefined) {
				throw new ActionMutationError<ServerError, ShapedErrors>({
					serverError: result.serverError,
					validationErrors: result.validationErrors,
				});
			}

			// Success: return data as TData.
			return result.data as Data;
		},
	};
}

export { ActionMutationError, hasServerError, hasValidationErrors, isActionMutationError } from "./errors";
export type * from "./index.types";
