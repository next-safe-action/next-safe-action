"use client";

import * as React from "react";
import { useActionBase } from "./hooks-shared";
import type {
	HookCallbacks,
	SingleInputActionFn,
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
export const useAction = <ServerError, Schema extends StandardSchemaV1 | undefined, ShapedErrors, Data>(
	safeActionFn: SingleInputActionFn<ServerError, Schema, ShapedErrors, Data>,
	cb?: HookCallbacks<ServerError, Schema, ShapedErrors, Data>
): UseActionHookReturn<ServerError, Schema, ShapedErrors, Data> => {
	const { result, clientInput, status, execute, executeAsync, reset, shorthandStatus } = useActionBase(
		safeActionFn,
		cb
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
	} & HookCallbacks<ServerError, Schema, ShapedErrors, Data>
): UseOptimisticActionHookReturn<ServerError, Schema, ShapedErrors, Data, State> => {
	const [optimisticState, setOptimisticValue] = React.useOptimistic<State, InferInputOrDefault<Schema, undefined>>(
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
		input: clientInput as InferInputOrDefault<Schema, undefined>,
		result,
		optimisticState,
		reset,
		status,
		...shorthandStatus,
	};
};

export type * from "./hooks.types";
