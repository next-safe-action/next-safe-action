"use client";

import * as React from "react";
import { useActionBase } from "./hooks-shared";
import { getActionShorthandStatusObject, getActionStatus, useActionCallbacks } from "./hooks-utils";
import type {
	HookBaseOptions,
	HookCallbacks,
	SingleInputActionFn,
	SingleInputStateActionFn,
	UseActionHookReturn,
	UseOptimisticActionHookReturn,
	UseStateActionHookReturn,
} from "./hooks.types";
import type { SafeActionResult } from "./index.types";
import { FrameworkErrorHandler } from "./next/errors";
import type { InferInputOrDefault, StandardSchemaV1 } from "./standard-schema";

// HOOKS

/**
 * Use the action from a Client Component via hook.
 * @param safeActionFn The action function
 * @param opts Optional configuration and callbacks
 *
 * {@link https://next-safe-action.dev/docs/execute-actions/hooks/useaction See docs for more information}
 */
export const useAction = <ServerError, Schema extends StandardSchemaV1 | undefined, ShapedErrors, Data>(
	safeActionFn: SingleInputActionFn<ServerError, Schema, ShapedErrors, Data>,
	opts?: HookBaseOptions<ServerError, Schema, ShapedErrors, Data>
): UseActionHookReturn<ServerError, Schema, ShapedErrors, Data> => {
	const { result, clientInput, status, execute, executeAsync, reset, shorthandStatus } = useActionBase(
		safeActionFn,
		opts
	);

	return {
		execute,
		executeAsync,
		input: clientInput as InferInputOrDefault<Schema, undefined>,
		result,
		reset,
		status,
		...shorthandStatus,
	};
};

/**
 * Use the action from a Client Component via hook, with optimistic data update.
 * @param safeActionFn The action function
 * @param utils Required `currentData` and `updateFn` and optional callbacks
 *
 * {@link https://next-safe-action.dev/docs/execute-actions/hooks/useoptimisticaction See docs for more information}
 */
export const useOptimisticAction = <
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
	State,
>(
	safeActionFn: SingleInputActionFn<ServerError, Schema, ShapedErrors, Data>,
	utils: {
		currentState: State;
		updateFn: (state: State, input: InferInputOrDefault<Schema, void>) => State;
	} & HookBaseOptions<ServerError, Schema, ShapedErrors, Data>
): UseOptimisticActionHookReturn<ServerError, Schema, ShapedErrors, Data, State> => {
	const [optimisticState, setOptimisticValue] = React.useOptimistic<State, InferInputOrDefault<Schema, undefined>>(
		utils.currentState,
		utils.updateFn
	);

	// Extract hook options from utils, excluding the useOptimisticAction-specific properties.
	const { currentState: _, updateFn: __, ...hookOpts } = utils;

	const { result, clientInput, status, execute, executeAsync, reset, shorthandStatus } = useActionBase(
		safeActionFn,
		hookOpts as HookBaseOptions<ServerError, Schema, ShapedErrors, Data>,
		setOptimisticValue
	);

	return {
		execute,
		executeAsync,
		input: clientInput as InferInputOrDefault<Schema, undefined>,
		result,
		optimisticState,
		reset,
		status,
		...shorthandStatus,
	};
};

/**
 * Use the stateful action from a Client Component via hook. Used for actions defined with
 * [`stateAction`](https://next-safe-action.dev/docs/define-actions/instance-methods#action--stateaction).
 *
 * Provides full lifecycle control: callbacks, status tracking, navigation error handling,
 * `executeAsync`, `reset`, and `formAction` for `<form action={formAction}>` integration.
 *
 * Requires React 19+ (Next.js 15+). On older versions, a runtime error is thrown with guidance.
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
	if (typeof React.useActionState !== "function") {
		throw new Error(
			"useStateAction requires React 19+ (Next.js 15+). " +
				"For older versions, use React's useActionState directly with your safe action."
		);
	}

	const initResult = opts?.initResult;

	// ─── Refs ────────────────────────────────────────────────────────────

	const asyncResolverRef = React.useRef<{
		resolve: (value: unknown) => void;
		reject: (reason: unknown) => void;
	} | null>(null);
	const prevResultOverrideRef = React.useRef<SafeActionResult<ServerError, Schema, ShapedErrors, Data> | null>(null);

	// ─── State ────────────────────────────────────────────────────────────

	const [navigationError, setNavigationError] = React.useState<Error | null>(null);
	const [thrownError, setThrownError] = React.useState<Error | null>(null);
	const [isIdle, setIsIdle] = React.useState(true);
	const [isReset, setIsReset] = React.useState(false);
	const [clientInput, setClientInput] = React.useState<InferInputOrDefault<Schema, void>>();
	const [isTransitioning, startTransition] = React.useTransition();

	// ─── Wrapper function ─────────────────────────────────────────────────
	// All state updates inside the wrapper are batched into the transition by React,
	// so they commit atomically with the result. This prevents the double-fire issue
	// that would occur if state were synced via a separate effect.

	const wrappedAction = React.useCallback(
		async (
			prevResult: SafeActionResult<ServerError, Schema, ShapedErrors, Data>,
			input: InferInputOrDefault<Schema, undefined>
		): Promise<SafeActionResult<ServerError, Schema, ShapedErrors, Data>> => {
			setIsIdle(false);
			setIsReset(false);
			setClientInput(input as InferInputOrDefault<Schema, void>);
			setNavigationError(null);
			setThrownError(null);

			const effectivePrevResult = prevResultOverrideRef.current ?? prevResult;
			prevResultOverrideRef.current = null;

			try {
				const result = await safeActionFn(effectivePrevResult, input);
				asyncResolverRef.current?.resolve(result);
				return result;
			} catch (e) {
				if (FrameworkErrorHandler.isNavigationError(e)) {
					setNavigationError(e);
					asyncResolverRef.current?.reject(e);
					return {};
				}

				setThrownError(e as Error);
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

	// ─── execute ──────────────────────────────────────────────────────────

	const execute = React.useCallback(
		(input: InferInputOrDefault<Schema, void>) => {
			setIsIdle(false);
			setIsReset(false);
			setNavigationError(null);
			setThrownError(null);
			setClientInput(input);

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
		prevResultOverrideRef.current = initResult ?? {};
	}, [initResult]);

	// ─── Status ───────────────────────────────────────────────────────────

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

export type * from "./hooks.types";
