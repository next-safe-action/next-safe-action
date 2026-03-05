import * as React from "react";
import type { HookActionStatus, HookCallbacks, HookShorthandStatus } from "./hooks.types";
import type { SafeActionResult } from "./index.types";
import { FrameworkErrorHandler } from "./next/errors";
import type { InferInputOrDefault, StandardSchemaV1 } from "./standard-schema";

export const getActionStatus = <ServerError, S extends StandardSchemaV1 | undefined, CVE, Data>({
	isIdle,
	isExecuting,
	result,
	hasNavigated,
	hasThrownError,
}: {
	isIdle: boolean;
	isExecuting: boolean;
	hasNavigated: boolean;
	hasThrownError: boolean;
	result: SafeActionResult<ServerError, S, CVE, Data>;
}): HookActionStatus => {
	if (isIdle) {
		return "idle";
	} else if (isExecuting) {
		return "executing";
	} else if (
		hasThrownError ||
		typeof result.validationErrors !== "undefined" ||
		typeof result.serverError !== "undefined"
	) {
		return "hasErrored";
	} else if (hasNavigated) {
		return "hasNavigated";
	} else {
		return "hasSucceeded";
	}
};

export const getActionShorthandStatusObject = ({
	status,
	isTransitioning,
}: {
	status: HookActionStatus;
	isTransitioning: boolean;
}): HookShorthandStatus => {
	return {
		isIdle: status === "idle",
		isExecuting: status === "executing",
		isTransitioning,
		isPending: status === "executing" || isTransitioning,
		hasSucceeded: status === "hasSucceeded",
		hasErrored: status === "hasErrored",
		hasNavigated: status === "hasNavigated",
	};
};

/**
 * Converts a callback to a ref to avoid triggering re-renders when passed as a
 * prop or avoid re-executing effects when passed as a dependency
 */
function useCallbackRef<T extends (arg: any) => any>(callback: T | undefined): T {
	const callbackRef = React.useRef(callback);
	React.useEffect(() => {
		callbackRef.current = callback;
	});
	return React.useMemo(() => ((arg) => callbackRef.current?.(arg) as T) as T, []);
}

export const useActionCallbacks = <ServerError, S extends StandardSchemaV1 | undefined, CVE, Data>({
	result,
	input,
	status,
	cb,
	navigationError,
	thrownError,
}: {
	result: SafeActionResult<ServerError, S, CVE, Data>;
	input: InferInputOrDefault<S, undefined>;
	status: HookActionStatus;
	cb?: HookCallbacks<ServerError, S, CVE, Data>;
	navigationError: Error | null;
	thrownError: Error | null;
}) => {
	const onExecute = useCallbackRef(cb?.onExecute);
	const onSuccess = useCallbackRef(cb?.onSuccess);
	const onError = useCallbackRef(cb?.onError);
	const onSettled = useCallbackRef(cb?.onSettled);
	const onNavigation = useCallbackRef(cb?.onNavigation);

	// Execute hook callbacks as non-visual side effects.
	React.useEffect(() => {
		const executeCallbacks = async () => {
			switch (status) {
				case "executing":
					await Promise.resolve(onExecute?.({ input })).then(() => {});
					break;
				case "hasSucceeded":
					if (navigationError || thrownError) {
						break;
					}

					await Promise.all([
						Promise.resolve(onSuccess?.({ data: result.data!, input })),
						Promise.resolve(onSettled?.({ result, input })),
					]);
					break;
				case "hasErrored":
					await Promise.all([
						Promise.resolve(
							onError?.({
								error: { ...result, ...(thrownError ? { thrownError } : {}) },
								input,
							})
						),
						Promise.resolve(onSettled?.({ result, input })),
					]);
					break;
			}

			// Navigation flow.
			// If the user redirected to a different page, the `hasNavigated` status never gets set.
			// In all the other cases, the `hasNavigated` status is set.
			if (!navigationError) return;
			const navigationKind = FrameworkErrorHandler.getNavigationKind(navigationError);

			if (navigationKind === "redirect" || status === "hasNavigated") {
				const actualNavigationKind = FrameworkErrorHandler.getNavigationKind(navigationError);
				await Promise.all([
					Promise.resolve(
						onNavigation?.({
							input,
							navigationKind: actualNavigationKind,
						})
					),
					Promise.resolve(onSettled?.({ result, input, navigationKind: actualNavigationKind })),
				]);
			}
		};

		executeCallbacks().catch(console.error);
	}, [input, status, result, navigationError, thrownError, onExecute, onSuccess, onSettled, onError, onNavigation]);
};
