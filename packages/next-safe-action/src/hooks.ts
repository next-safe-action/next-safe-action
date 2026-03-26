"use client";

import * as React from "react";
import { useActionBase } from "./hooks-shared";
import type {
	HookCallbacks,
	HookSafeActionFn,
	UseActionHookReturn,
	UseOptimisticActionHookReturn,
} from "./hooks.types";
import type { InferInputOrDefault, StandardSchemaV1 } from "./standard-schema";

// HOOKS

/**
 * Use the action from a Client Component via hook.
 * @param safeActionFn The action function
 * @param cb Optional base utils and callbacks
 *
 * {@link https://next-safe-action.dev/docs/execute-actions/hooks/useaction See docs for more information}
 */
export const useAction = <ServerError, S extends StandardSchemaV1 | undefined, CVE, Data>(
	safeActionFn: HookSafeActionFn<ServerError, S, CVE, Data>,
	cb?: HookCallbacks<ServerError, S, CVE, Data>
): UseActionHookReturn<ServerError, S, CVE, Data> => {
	const { result, clientInput, status, execute, executeAsync, reset, shorthandStatus } =
		useActionBase(safeActionFn, cb);

	return {
		execute,
		executeAsync,
		input: clientInput as InferInputOrDefault<S, undefined>,
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
export const useOptimisticAction = <ServerError, S extends StandardSchemaV1 | undefined, CVE, Data, State>(
	safeActionFn: HookSafeActionFn<ServerError, S, CVE, Data>,
	utils: {
		currentState: State;
		updateFn: (state: State, input: InferInputOrDefault<S, void>) => State;
	} & HookCallbacks<ServerError, S, CVE, Data>
): UseOptimisticActionHookReturn<ServerError, S, CVE, Data, State> => {
	const [optimisticState, setOptimisticValue] = React.useOptimistic<State, InferInputOrDefault<S, undefined>>(
		utils.currentState,
		utils.updateFn
	);

	const { result, clientInput, status, execute, executeAsync, reset, shorthandStatus } = useActionBase(
		safeActionFn,
		{
			onExecute: utils.onExecute,
			onSuccess: utils.onSuccess,
			onError: utils.onError,
			onSettled: utils.onSettled,
			onNavigation: utils.onNavigation,
		},
		setOptimisticValue
	);

	return {
		execute,
		executeAsync,
		input: clientInput as InferInputOrDefault<S, undefined>,
		result,
		optimisticState,
		reset,
		status,
		...shorthandStatus,
	};
};

export type * from "./hooks.types";
