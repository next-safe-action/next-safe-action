"use client";

import * as React from "react";
import { getActionShorthandStatusObject, getActionStatus, useActionCallbacks } from "./hooks-utils";
import type { HookCallbacks, SingleInputStateActionFn, UseStateActionHookReturn } from "./hooks.types";
import type { InferInputOrDefault, StandardSchemaV1 } from "./standard-schema";

/**
 * Use the stateful action from a Client Component via hook. Used for actions defined with [`stateAction`](https://next-safe-action.dev/docs/define-actions/instance-methods#action--stateaction).
 * @param safeActionFn The action function
 * @param utils Optional `initResult`, `permalink` and callbacks
 * @deprecated Directly use `useActionState` hook from `react` instead.
 *
 * {@link https://next-safe-action.dev/docs/execute-actions/hooks/usestateaction See docs for more information}
 */
export const useStateAction = <ServerError, Schema extends StandardSchemaV1 | undefined, ShapedErrors, Data>(
	safeActionFn: SingleInputStateActionFn<ServerError, Schema, ShapedErrors, Data>,
	utils?: {
		initResult?: Awaited<ReturnType<typeof safeActionFn>>;
		permalink?: string;
	} & HookCallbacks<ServerError, Schema, ShapedErrors, Data>
): UseStateActionHookReturn<ServerError, Schema, ShapedErrors, Data> => {
	const [result, dispatcher, isExecuting] = React.useActionState(
		safeActionFn,
		utils?.initResult ?? {},
		utils?.permalink
	);
	const [isIdle, setIsIdle] = React.useState(true);
	const [isTransitioning, startTransition] = React.useTransition();
	const [clientInput, setClientInput] = React.useState<InferInputOrDefault<Schema, void>>();
	const status = getActionStatus<ServerError, Schema, ShapedErrors, Data>({
		isExecuting,
		result: result ?? {},
		isIdle,
		// HACK: This is a workaround to avoid the status being "hasNavigated" when the action is executed.
		hasNavigated: false,
		hasThrownError: false,
	});

	const execute = React.useCallback(
		(input: InferInputOrDefault<Schema, void>) => {
			setIsIdle(false);
			setClientInput(input);

			startTransition(() => {
				dispatcher(input as InferInputOrDefault<Schema, undefined>);
			});
		},
		[dispatcher]
	);

	useActionCallbacks({
		result: result ?? {},
		input: clientInput as InferInputOrDefault<Schema, undefined>,
		status,
		cb: {
			onExecute: utils?.onExecute,
			onSuccess: utils?.onSuccess,
			onError: utils?.onError,
			onSettled: utils?.onSettled,
		},
		navigationError: null,
		thrownError: null,
	});

	return {
		execute,
		input: clientInput as InferInputOrDefault<Schema, undefined>,
		result,
		status,
		...getActionShorthandStatusObject({ status, isTransitioning }),
	};
};
