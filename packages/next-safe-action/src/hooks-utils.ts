import * as React from "react";
import type { HookActionStatus, HookCallbacks, HookShorthandStatus } from "./hooks.types";
import type { NavigationKind, NormalizeActionResult, SafeActionResult } from "./index.types";
import { FrameworkErrorHandler } from "./next/errors";
import type { InferInputOrDefault, StandardSchemaV1 } from "./standard-schema";

export const getActionStatus = <ServerError, Schema extends StandardSchemaV1 | undefined, ShapedErrors, Data>({
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
	result: SafeActionResult<ServerError, Schema, ShapedErrors, Data>;
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
		// An idle status must never report pending: after a mid-flight `reset` the underlying
		// React transition can't be cancelled, so `isTransitioning` may stay true while the
		// status already reads idle. Reset wins, stale work is invisible.
		isPending: status === "executing" || (isTransitioning && status !== "idle"),
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

export const useActionCallbacks = <ServerError, Schema extends StandardSchemaV1 | undefined, ShapedErrors, Data>({
	result,
	input,
	status,
	executionId,
	cb,
	throwOnNavigation,
	navigationError,
	thrownError,
}: {
	result: SafeActionResult<ServerError, Schema, ShapedErrors, Data>;
	input: InferInputOrDefault<Schema, undefined>;
	status: HookActionStatus;
	/**
	 * Identifies the execution the currently reported state belongs to. Advances only together
	 * with the dispatch-time state itself, never before it, and starts at `0` (no execution yet).
	 */
	executionId: number;
	cb?: HookCallbacks<ServerError, Schema, ShapedErrors, Data>;
	throwOnNavigation: boolean;
	navigationError: Error | null;
	thrownError: Error | null;
}) => {
	const onExecute = useCallbackRef(cb?.onExecute);
	const onSuccess = useCallbackRef(cb?.onSuccess);
	const onError = useCallbackRef(cb?.onError);
	const onSettled = useCallbackRef(cb?.onSettled);
	const onNavigation = useCallbackRef(cb?.onNavigation);

	// Snapshot of the execution state the callbacks last fired for. Every
	// execution replaces these values with fresh identities (`setResult`,
	// `setClientInput`, ...), so an effect re-run where all of them are
	// identical to the snapshot is a replay of already-handled state, e.g.
	// React `<Activity>` restoring a page from the Next.js router bfcache
	// (state preserved, effects re-fired), never a new status transition.
	// Kept in a ref because refs survive the `<Activity>` hide/show cycle.
	const lastHandledRef = React.useRef<{
		status: HookActionStatus;
		result: SafeActionResult<ServerError, Schema, ShapedErrors, Data>;
		input: InferInputOrDefault<Schema, undefined>;
		navigationError: Error | null;
		thrownError: Error | null;
	} | null>(null);

	// `onExecute` announces a dispatch, so it must fire once per dispatch, not once per commit
	// that happens to read `executing`. A single dispatch can produce two such commits: React
	// flips `useActionState`'s pending flag at sync priority, which can land a commit before the
	// dispatch state (`clientInput` and friends) does. Those two commits carry different inputs,
	// so the snapshot guard above does not cover them. `executionId` advances only with the
	// dispatch state, so the first commit carrying a new one is also the first with the real input.
	const lastExecutionIdRef = React.useRef(0);

	// The navigation callbacks fire on the first commit that carries a redirect, before the status
	// reaches `hasNavigated` (see the navigation flow below). Both hooks land the navigation error
	// and the end of the `executing` status in two separate commits, so the same redirect is seen
	// twice with a different `status`, and the snapshot guard above lets both through. Remember the
	// navigation already delivered as the pair (error, execution): the error identity alone is not
	// enough, a test can reject two executions with one error object, and the execution alone is
	// not enough either, since `executionId` names the latest dispatched execution while a queued
	// `useStateAction` dispatch can still surface the navigation error of the one before it.
	// Decided and recorded synchronously in the effect, never after an awaited user callback: a
	// delayed older continuation would otherwise overwrite the record of a newer navigation and
	// let its `hasNavigated` commit fire it again.
	const lastNavigationRef = React.useRef<{ error: Error; executionId: number } | null>(null);

	// Execute hook callbacks as non-visual side effects.
	React.useEffect(() => {
		const last = lastHandledRef.current;

		// Fire callbacks once per execution: skip replays of an
		// already-handled execution state (see `lastHandledRef` above).
		if (
			last &&
			last.status === status &&
			last.result === result &&
			last.input === input &&
			last.navigationError === navigationError &&
			last.thrownError === thrownError
		) {
			return;
		}

		lastHandledRef.current = { status, result, input, navigationError, thrownError };

		// Navigation flow.
		// Skip navigation callbacks when throwOnNavigation is true: the render-phase throw
		// is the primary guard, but this explicit check prevents race conditions and protects
		// against edge cases in concurrent mode or JavaScript usage without TypeScript.
		// A redirect is delivered as soon as its error commits, while the status may still read
		// `executing`: in Next.js the redirect navigates on its own, so waiting for `hasNavigated`
		// could unmount this component first. The other kinds wait for `hasNavigated`.
		let navigationKind: NavigationKind | null = null;
		if (!throwOnNavigation && navigationError) {
			const kind = FrameworkErrorHandler.getNavigationKind(navigationError);
			const delivered = lastNavigationRef.current;
			const alreadyDelivered = delivered?.error === navigationError && delivered.executionId === executionId;

			if ((kind === "redirect" || status === "hasNavigated") && !alreadyDelivered) {
				lastNavigationRef.current = { error: navigationError, executionId };
				navigationKind = kind;
			}
		}

		const executeCallbacks = async () => {
			switch (status) {
				case "executing":
					// Once per dispatch (see `lastExecutionIdRef`), never for the initial `0`.
					if (executionId === lastExecutionIdRef.current) {
						break;
					}

					lastExecutionIdRef.current = executionId;
					await Promise.resolve(onExecute?.({ input })).then(() => {});
					break;
				case "hasSucceeded":
					if (navigationError || thrownError) {
						break;
					}

					await Promise.all([
						Promise.resolve(onSuccess?.({ data: result.data!, input })),
						// Cast rationale: `onSettled`'s public type uses
						// `NormalizeActionResult` so void actions surface `data: undefined`,
						// but internally `result` is the raw `SafeActionResult<..., Data>`.
						// The two are structurally equivalent for every concrete `Data` the
						// runtime produces, see the comment in `useActionBase`.
						Promise.resolve(
							onSettled?.({
								result: result as unknown as NormalizeActionResult<
									SafeActionResult<ServerError, Schema, ShapedErrors, Data>
								>,
								input,
							})
						),
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
						Promise.resolve(
							onSettled?.({
								result: result as unknown as NormalizeActionResult<
									SafeActionResult<ServerError, Schema, ShapedErrors, Data>
								>,
								input,
							})
						),
					]);
					break;
			}

			if (navigationKind === null) return;

			await Promise.all([
				Promise.resolve(
					onNavigation?.({
						input,
						navigationKind,
					})
				),
				Promise.resolve(
					onSettled?.({
						result: result as unknown as NormalizeActionResult<
							SafeActionResult<ServerError, Schema, ShapedErrors, Data>
						>,
						input,
						navigationKind,
					})
				),
			]);
		};

		executeCallbacks().catch(console.error);
	}, [
		input,
		status,
		executionId,
		result,
		throwOnNavigation,
		navigationError,
		thrownError,
		onExecute,
		onSuccess,
		onSettled,
		onError,
		onNavigation,
	]);
};
