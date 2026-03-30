"use client";

import * as React from "react";
import { getActionShorthandStatusObject, getActionStatus, useActionCallbacks } from "./hooks-utils";
import type { HookBaseOptions, HookCallbacks, SingleInputStateActionFn, UseStateActionHookReturn } from "./hooks.types";
import type { SafeActionResult } from "./index.types";
import { FrameworkErrorHandler } from "./next/errors";
import type { InferInputOrDefault, StandardSchemaV1 } from "./standard-schema";

/**
 * Use the stateful action from a Client Component via hook. Used for actions defined with
 * [`stateAction`](https://next-safe-action.dev/docs/define-actions/instance-methods#action--stateaction).
 *
 * Provides full lifecycle control: callbacks, status tracking, navigation error handling,
 * `executeAsync`, `reset`, and `formAction` for `<form action={formAction}>` integration.
 *
 * @param safeActionFn The stateful action function created with `.stateAction()`.
 * @param opts Optional configuration: `initResult` for initial state, plus all hook options and callbacks.
 *
 * {@link https://next-safe-action.dev/docs/execute-actions/hooks/usestateaction See docs for more information}
 */
export const useStateAction = <ServerError, Schema extends StandardSchemaV1 | undefined, ShapedErrors, Data>(
	safeActionFn: SingleInputStateActionFn<ServerError, Schema, ShapedErrors, Data>,
	opts?: {
		initResult?: Awaited<ReturnType<typeof safeActionFn>>;
	} & HookBaseOptions<ServerError, Schema, ShapedErrors, Data>
): UseStateActionHookReturn<ServerError, Schema, ShapedErrors, Data> => {
	const initResult = opts?.initResult;

	// ─── Side-channel refs ───────────────────────────────────────────────
	// Refs bridge the gap between the async wrapper execution and the synchronous render cycle.
	// The wrapper stores error/input info in refs; an effect syncs them to state after the action settles.

	const navigationErrorRef = React.useRef<Error | null>(null);
	const thrownErrorRef = React.useRef<Error | null>(null);
	const asyncResolverRef = React.useRef<{
		resolve: (value: unknown) => void;
		reject: (reason: unknown) => void;
	} | null>(null);
	const clientInputRef = React.useRef<InferInputOrDefault<Schema, void> | undefined>(undefined);
	const prevResultOverrideRef = React.useRef<SafeActionResult<ServerError, Schema, ShapedErrors, Data> | null>(null);

	// ─── State ────────────────────────────────────────────────────────────

	const [navigationError, setNavigationError] = React.useState<Error | null>(null);
	const [thrownError, setThrownError] = React.useState<Error | null>(null);
	const [isIdle, setIsIdle] = React.useState(true);
	const [isReset, setIsReset] = React.useState(false);
	const [clientInput, setClientInput] = React.useState<InferInputOrDefault<Schema, void>>();
	const [isTransitioning, startTransition] = React.useTransition();

	// ─── Wrapper function ─────────────────────────────────────────────────
	// Intercepts errors before React's useActionState sees them.
	// Navigation errors: caught, stored in ref, return {} (keeps component mounted).
	// Non-navigation thrown errors: stored in ref, re-thrown (error boundary).
	// Also handles prevResult override for reset() and tracks clientInput for formAction submissions.

	const wrappedAction = React.useCallback(
		async (
			prevResult: SafeActionResult<ServerError, Schema, ShapedErrors, Data>,
			input: InferInputOrDefault<Schema, undefined>
		): Promise<SafeActionResult<ServerError, Schema, ShapedErrors, Data>> => {
			// State management for both execute and formAction paths.
			// These updates are batched into the transition by React.
			setIsIdle(false);
			setIsReset(false);
			clientInputRef.current = input;
			navigationErrorRef.current = null;
			thrownErrorRef.current = null;

			// After reset(), use the overridden prevResult (initResult) instead of useActionState's stale state.
			// This is a one-shot override: cleared after use.
			const effectivePrevResult = prevResultOverrideRef.current ?? prevResult;
			prevResultOverrideRef.current = null;

			try {
				const result = await safeActionFn(effectivePrevResult, input);
				asyncResolverRef.current?.resolve(result);
				return result;
			} catch (e) {
				if (FrameworkErrorHandler.isNavigationError(e)) {
					navigationErrorRef.current = e;
					asyncResolverRef.current?.reject(e);
					return {};
				}

				thrownErrorRef.current = e as Error;
				asyncResolverRef.current?.reject(e);
				throw e;
			} finally {
				asyncResolverRef.current = null;
			}
		},
		[safeActionFn]
	);

	// ─── Core useActionState ──────────────────────────────────────────────

	const [rawResult, dispatcher, isExecuting] = React.useActionState(wrappedAction, initResult ?? {});

	// ─── Sync refs to state ───────────────────────────────────────────────
	// When rawResult changes (action completed), sync ref values to state.
	// This covers both execute() and formAction submission paths.

	React.useEffect(() => {
		if (isIdle) return;

		setNavigationError(navigationErrorRef.current);
		setThrownError(thrownErrorRef.current);
		setClientInput(clientInputRef.current);
	}, [rawResult, isIdle]);

	// ─── execute ──────────────────────────────────────────────────────────

	const execute = React.useCallback(
		(input: InferInputOrDefault<Schema, void>) => {
			setIsIdle(false);
			setIsReset(false);
			setNavigationError(null);
			setThrownError(null);
			setClientInput(input);
			navigationErrorRef.current = null;
			thrownErrorRef.current = null;

			startTransition(() => {
				dispatcher(input as InferInputOrDefault<Schema, undefined>);
			});
		},
		[dispatcher]
	);

	// ─── executeAsync ─────────────────────────────────────────────────────

	const executeAsync = React.useCallback(
		(input: InferInputOrDefault<Schema, void>) => {
			return new Promise<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>((resolve, reject) => {
				asyncResolverRef.current = {
					resolve: resolve as (value: unknown) => void,
					reject,
				};
				execute(input);
			});
		},
		[execute]
	);

	// ─── reset ────────────────────────────────────────────────────────────

	const reset = React.useCallback(() => {
		setIsIdle(true);
		setIsReset(true);
		setNavigationError(null);
		setThrownError(null);
		setClientInput(undefined);
		navigationErrorRef.current = null;
		thrownErrorRef.current = null;
		// Override prevResult for the next execution so the server sees initResult, not stale state.
		prevResultOverrideRef.current = initResult ?? {};
	}, [initResult]);

	// ─── Status computation ───────────────────────────────────────────────
	// For formAction submissions, isIdle might still be true during the first render
	// (wrapper's setIsIdle(false) is batched into the transition). Using isIdle && !isExecuting
	// ensures status is "executing" when isPending=true even if isIdle hasn't committed yet.

	const result = isReset ? ({} as SafeActionResult<ServerError, Schema, ShapedErrors, Data>) : (rawResult ?? {});

	const status = getActionStatus<ServerError, Schema, ShapedErrors, Data>({
		isExecuting,
		result,
		isIdle: isIdle && !isExecuting,
		hasNavigated: navigationError !== null,
		hasThrownError: thrownError !== null,
	});

	// ─── Callbacks ────────────────────────────────────────────────────────

	useActionCallbacks({
		result,
		input: clientInput as InferInputOrDefault<Schema, undefined>,
		status,
		cb: opts as HookCallbacks<ServerError, Schema, ShapedErrors, Data> | undefined,
		throwOnNavigation: opts?.throwOnNavigation === true,
		navigationError,
		thrownError,
	});

	// ─── throwOnNavigation ────────────────────────────────────────────────
	// When explicitly enabled, throw navigation errors during React's render phase
	// so they reach the nearest error boundary (e.g., Next.js HTTPAccessFallbackBoundary).

	if (opts?.throwOnNavigation === true && navigationError !== null) {
		throw navigationError;
	}

	// ─── Return ───────────────────────────────────────────────────────────

	return {
		execute,
		executeAsync,
		formAction: dispatcher as (input: InferInputOrDefault<Schema, void>) => void,
		input: clientInput as InferInputOrDefault<Schema, undefined>,
		result,
		reset,
		status,
		...getActionShorthandStatusObject({ status, isTransitioning }),
	};
};
