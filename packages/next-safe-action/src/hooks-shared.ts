"use client";

import * as React from "react";
import { getActionShorthandStatusObject, getActionStatus, useActionCallbacks } from "./hooks-utils";
import type {
	HookActionStatus,
	HookBaseOptions,
	HookCallbacks,
	SingleInputActionFn,
	HookShorthandStatus,
} from "./hooks.types";
import type { NormalizeActionResult, SafeActionResult } from "./index.types";
import { FrameworkErrorHandler } from "./next/errors";
import type { InferInputOrDefault, StandardSchemaV1 } from "./standard-schema";

/**
 * Shared base hook for `useAction` and `useOptimisticAction`.
 * Extracts common state management, execution logic, and callback wiring.
 *
 * @param onTransitionStart Optional callback invoked inside `startTransition` before the action runs.
 *   Used by `useOptimisticAction` to call `setOptimisticValue`.
 */
export function useActionBase<ServerError, Schema extends StandardSchemaV1 | undefined, ShapedErrors, Data>(
	safeActionFn: SingleInputActionFn<ServerError, Schema, ShapedErrors, Data>,
	opts: HookBaseOptions<ServerError, Schema, ShapedErrors, Data> | undefined,
	onTransitionStart?: (input: InferInputOrDefault<Schema, undefined>) => void
): {
	isTransitioning: boolean;
	// Exposed as `NormalizeActionResult<...>` so that void-returning actions
	// surface `data: undefined` rather than `data: void | undefined`. The
	// internal `useState` still holds the raw `SafeActionResult` union — the
	// type-only narrowing happens once at this boundary via a cast.
	result: NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>;
	clientInput: InferInputOrDefault<Schema, void> | undefined;
	status: HookActionStatus;
	execute: (input: InferInputOrDefault<Schema, void>) => void;
	executeAsync: (
		input: InferInputOrDefault<Schema, void>
	) => Promise<NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>>;
	reset: () => void;
	shorthandStatus: HookShorthandStatus;
} {
	const [isTransitioning, startTransition] = React.useTransition();
	const [result, setResult] = React.useState<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>({});
	const [clientInput, setClientInput] = React.useState<InferInputOrDefault<Schema, void>>();
	const [isExecuting, setIsExecuting] = React.useState(false);
	const [navigationError, setNavigationError] = React.useState<Error | null>(null);
	const [thrownError, setThrownError] = React.useState<Error | null>(null);
	const [isIdle, setIsIdle] = React.useState(true);

	// Request ordering: only the latest request's response updates UI state.
	// This prevents stale responses from overwriting fresh state on rapid calls.
	const requestIdRef = React.useRef(0);

	// Stable ref for the transition start callback to avoid destabilizing execute/executeAsync.
	const onTransitionStartRef = React.useRef(onTransitionStart);
	onTransitionStartRef.current = onTransitionStart;

	const status = getActionStatus<ServerError, Schema, ShapedErrors, Data>({
		isExecuting,
		result,
		isIdle,
		hasNavigated: navigationError !== null,
		hasThrownError: thrownError !== null,
	});

	const execute = React.useCallback(
		(input: InferInputOrDefault<Schema, void>) => {
			const thisRequestId = ++requestIdRef.current;

			// Set state synchronously before starting the transition.
			setIsIdle(false);
			setNavigationError(null);
			setThrownError(null);
			setClientInput(input);
			setIsExecuting(true);

			startTransition(() => {
				onTransitionStartRef.current?.(input as InferInputOrDefault<Schema, undefined>);

				safeActionFn(input as InferInputOrDefault<Schema, undefined>)
					.then((res) => {
						if (thisRequestId !== requestIdRef.current) return;
						setResult(res ?? {});
					})
					.catch((e) => {
						if (thisRequestId === requestIdRef.current) {
							setResult({});

							if (FrameworkErrorHandler.isNavigationError(e)) {
								setNavigationError(e);
							} else {
								setThrownError(e as Error);
							}
						}

						// Only re-throw non-navigation errors for React error boundary handling.
						// Navigation errors are handled via render-phase throw (throwOnNavigation).
						if (!FrameworkErrorHandler.isNavigationError(e)) {
							throw e;
						}
					})
					.finally(() => {
						if (thisRequestId !== requestIdRef.current) return;
						setIsExecuting(false);
					});
			});
		},
		[safeActionFn]
	);

	const executeAsync = React.useCallback(
		(input: InferInputOrDefault<Schema, void>) => {
			return new Promise<Awaited<ReturnType<typeof safeActionFn>>>((resolve, reject) => {
				const thisRequestId = ++requestIdRef.current;

				setIsIdle(false);
				setNavigationError(null);
				setThrownError(null);
				setClientInput(input);
				setIsExecuting(true);

				startTransition(() => {
					onTransitionStartRef.current?.(input as InferInputOrDefault<Schema, undefined>);

					safeActionFn(input as InferInputOrDefault<Schema, undefined>)
						.then((res) => {
							if (thisRequestId === requestIdRef.current) {
								setResult(res ?? {});
							}
							// Always resolve so the caller's await settles.
							resolve(res);
						})
						.catch((e) => {
							if (thisRequestId === requestIdRef.current) {
								setResult({});

								if (FrameworkErrorHandler.isNavigationError(e)) {
									setNavigationError(e);
								} else {
									setThrownError(e as Error);
								}
							}

							// Always reject so the caller's await settles.
							reject(e);

							// Only re-throw non-navigation errors for React error boundary handling.
							// Navigation errors are handled via render-phase throw (throwOnNavigation).
							if (!FrameworkErrorHandler.isNavigationError(e)) {
								throw e;
							}
						})
						.finally(() => {
							if (thisRequestId !== requestIdRef.current) return;
							setIsExecuting(false);
						});
				});
			});
		},
		[safeActionFn]
	);

	const reset = React.useCallback(() => {
		setIsIdle(true);
		setNavigationError(null);
		setThrownError(null);
		setClientInput(undefined);
		setResult({});
	}, []);

	useActionCallbacks({
		result: result ?? {},
		input: clientInput as InferInputOrDefault<Schema, undefined>,
		status,
		throwOnNavigation: opts?.throwOnNavigation === true,
		navigationError,
		thrownError,
		// Cast: HookBaseOptions is a discriminated union that always includes callback properties at runtime.
		// When throwOnNavigation is true, onNavigation/onSettled are omitted from the type but absent at runtime too.
		cb: opts as HookCallbacks<ServerError, Schema, ShapedErrors, Data> | undefined,
	});

	// When throwOnNavigation is explicitly enabled, throw navigation errors during React's render
	// phase so they reach the nearest error boundary. In Next.js, this is HTTPAccessFallbackBoundary,
	// which shows 404/403/401 pages.
	if (opts?.throwOnNavigation === true && navigationError !== null) {
		throw navigationError;
	}

	return {
		isTransitioning,
		// `result` and `executeAsync` are structurally compatible with
		// `NormalizeActionResult<SafeActionResult<...>>` for every concrete `Data`
		// the runtime ever produces — `NormalizeActionResult` only drops the
		// `{ data: void }` branch, which the action builder never emits (see
		// `buildResultAndRunCallbacks` in `action-builder.ts`). TypeScript can't
		// verify this while `Data` is still a free generic, so the cast is
		// isolated here and not repeated across every consumer hook.
		result: result as unknown as NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>,
		clientInput,
		status,
		execute,
		executeAsync: executeAsync as unknown as (
			input: InferInputOrDefault<Schema, void>
		) => Promise<NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>>,
		reset,
		shorthandStatus: getActionShorthandStatusObject({ status, isTransitioning }),
	};
}
