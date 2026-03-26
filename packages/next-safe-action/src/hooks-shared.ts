"use client";

import * as React from "react";
import { getActionShorthandStatusObject, getActionStatus, useActionCallbacks } from "./hooks-utils";
import type { HookActionStatus, HookCallbacks, HookSafeActionFn, HookShorthandStatus } from "./hooks.types";
import type { SafeActionResult } from "./index.types";
import { FrameworkErrorHandler } from "./next/errors";
import type { InferInputOrDefault, StandardSchemaV1 } from "./standard-schema";

/**
 * Shared base hook for `useAction` and `useOptimisticAction`.
 * Extracts common state management, execution logic, and callback wiring.
 *
 * @param onTransitionStart Optional callback invoked inside `startTransition` before the action runs.
 *   Used by `useOptimisticAction` to call `setOptimisticValue`.
 */
export function useActionBase<ServerError, S extends StandardSchemaV1 | undefined, CVE, Data>(
	safeActionFn: HookSafeActionFn<ServerError, S, CVE, Data>,
	cb: HookCallbacks<ServerError, S, CVE, Data> | undefined,
	onTransitionStart?: (input: InferInputOrDefault<S, undefined>) => void
): {
	isTransitioning: boolean;
	result: SafeActionResult<ServerError, S, CVE, Data>;
	clientInput: InferInputOrDefault<S, void> | undefined;
	status: HookActionStatus;
	execute: (input: InferInputOrDefault<S, void>) => void;
	executeAsync: (input: InferInputOrDefault<S, void>) => Promise<Awaited<ReturnType<typeof safeActionFn>>>;
	reset: () => void;
	shorthandStatus: HookShorthandStatus;
} {
	const [isTransitioning, startTransition] = React.useTransition();
	const [result, setResult] = React.useState<SafeActionResult<ServerError, S, CVE, Data>>({});
	const [clientInput, setClientInput] = React.useState<InferInputOrDefault<S, void>>();
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

	const status = getActionStatus<ServerError, S, CVE, Data>({
		isExecuting,
		result,
		isIdle,
		hasNavigated: navigationError !== null,
		hasThrownError: thrownError !== null,
	});

	const execute = React.useCallback(
		(input: InferInputOrDefault<S, void>) => {
			const thisRequestId = ++requestIdRef.current;

			// Set state synchronously before starting the transition.
			setIsIdle(false);
			setNavigationError(null);
			setThrownError(null);
			setClientInput(input);
			setIsExecuting(true);

			startTransition(() => {
				onTransitionStartRef.current?.(input as InferInputOrDefault<S, undefined>);

				safeActionFn(input as InferInputOrDefault<S, undefined>)
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

						throw e;
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
		(input: InferInputOrDefault<S, void>) => {
			return new Promise<Awaited<ReturnType<typeof safeActionFn>>>((resolve, reject) => {
				const thisRequestId = ++requestIdRef.current;

				setIsIdle(false);
				setNavigationError(null);
				setThrownError(null);
				setClientInput(input);
				setIsExecuting(true);

				startTransition(() => {
					onTransitionStartRef.current?.(input as InferInputOrDefault<S, undefined>);

					safeActionFn(input as InferInputOrDefault<S, undefined>)
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

							// Always reject so the caller's await settles (fixes executeAsync + navigation hang).
							reject(e);
							throw e;
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
		input: clientInput as InferInputOrDefault<S, undefined>,
		status,
		navigationError,
		thrownError,
		cb,
	});

	return {
		isTransitioning,
		result,
		clientInput,
		status,
		execute,
		executeAsync,
		reset,
		shorthandStatus: getActionShorthandStatusObject({ status, isTransitioning }),
	};
}
