"use client";

import type { ValidationErrors } from "next-safe-action";
import type { HookSafeActionFn } from "next-safe-action/hooks";
import { useAction, useOptimisticAction } from "next-safe-action/hooks";
import * as React from "react";
import type { Resolver } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { HookProps, UseHookFormActionHookReturn, UseHookFormOptimisticActionHookReturn } from "./hooks.types";
import type { ErrorMapperProps } from "./index";
import { mapToHookFormErrors } from "./index";
import type { InferInputOrDefault, InferOutputOrDefault, StandardSchemaV1 } from "./standard-schema";

/**
 * For more advanced use cases where you want full customization of the hooks used, you can
 * use this hook to map a validation errors object to a `FieldErrors` compatible with react-hook-form.
 * You can then pass the returned `hookFormValidationErrors` property to `useForm`'s `errors` prop.
 *
 * @param validationErrors Validation errors object from `next-safe-action`
 * @returns Object of `FieldErrors` compatible with react-hook-form
 */
export function useHookFormActionErrorMapper<S extends StandardSchemaV1 | undefined>(
	validationErrors: ValidationErrors<S> | undefined,
	props?: ErrorMapperProps
) {
	const hookFormValidationErrors = React.useMemo(
		() => mapToHookFormErrors<S>(validationErrors, props),
		[validationErrors, props]
	);

	return {
		hookFormValidationErrors,
	};
}

/**
 * This hook is a wrapper around `useAction` and `useForm` that makes it easier to use safe actions
 * with react-hook-form. It also maps validation errors to `FieldErrors` compatible with react-hook-form.
 *
 * @param safeAction The safe action
 * @param hookFormResolver A react-hook-form validation resolver
 * @param props Optional props for both `useAction`, `useForm` hooks and error mapper
 * @returns An object containing `action` and `form` controllers, `handleActionSubmit`, and `resetFormAndAction`
 */
export function useHookFormAction<ServerError, S extends StandardSchemaV1 | undefined, CVE, Data, FormContext = any>(
	safeAction: HookSafeActionFn<ServerError, S, CVE, Data>,
	hookFormResolver: Resolver<InferInputOrDefault<S, any>, FormContext, InferOutputOrDefault<S, any>>,
	props?: HookProps<ServerError, S, CVE, Data, FormContext>
): UseHookFormActionHookReturn<ServerError, S, CVE, Data, FormContext> {
	const action = useAction(safeAction, props?.actionProps);

	const { hookFormValidationErrors } = useHookFormActionErrorMapper<S>(
		action.result.validationErrors as ValidationErrors<S> | undefined,
		props?.errorMapProps
	);

	const form = useForm<InferInputOrDefault<S, any>, FormContext, InferOutputOrDefault<S, any>>({
		...props?.formProps,
		resolver: hookFormResolver,
		errors: hookFormValidationErrors,
	});

	const { handleSubmit, reset: resetForm } = form;
	const { executeAsync, reset: resetAction } = action;

	const handleSubmitWithAction = React.useCallback(
		(e?: React.BaseSyntheticEvent) => handleSubmit(executeAsync)(e),
		[handleSubmit, executeAsync]
	);

	const resetFormAndAction = React.useCallback(() => {
		resetForm();
		resetAction();
	}, [resetForm, resetAction]);

	return {
		action,
		form,
		handleSubmitWithAction,
		resetFormAndAction,
	};
}

/**
 * This hook is a wrapper around `useOptimisticAction` and `useForm` that makes it easier to use safe actions
 * with react-hook-form. It also maps validation errors to `FieldErrors` compatible with react-hook-form.
 *
 * @param safeAction The safe action
 * @param hookFormResolver A react-hook-form validation resolver
 * @param props Required `currentState` and `updateFn` props for the action, and additional optional
 * props for both `useAction`, `useForm` hooks and error mapper
 * @returns An object containing `action` and `form` controllers, `handleActionSubmit`, and `resetFormAndAction`
 */
export function useHookFormOptimisticAction<
	ServerError,
	S extends StandardSchemaV1 | undefined,
	CVE,
	Data,
	State,
	FormContext = any,
>(
	safeAction: HookSafeActionFn<ServerError, S, CVE, Data>,
	hookFormResolver: Resolver<InferInputOrDefault<S, any>, FormContext, InferOutputOrDefault<S, any>>,
	props: HookProps<ServerError, S, CVE, Data, FormContext> & {
		actionProps: {
			currentState: State;
			updateFn: (state: State, input: InferInputOrDefault<S, void>) => State;
		};
	}
): UseHookFormOptimisticActionHookReturn<ServerError, S, CVE, Data, State, FormContext> {
	const action = useOptimisticAction(safeAction, props.actionProps);

	const { hookFormValidationErrors } = useHookFormActionErrorMapper<S>(
		action.result.validationErrors as ValidationErrors<S> | undefined,
		props.errorMapProps
	);

	const form = useForm<InferInputOrDefault<S, any>, FormContext, InferOutputOrDefault<S, any>>({
		...props?.formProps,
		resolver: hookFormResolver,
		errors: hookFormValidationErrors,
	});

	const { handleSubmit, reset: resetForm } = form;
	const { executeAsync, reset: resetAction } = action;

	const handleSubmitWithAction = React.useCallback(
		(e?: React.BaseSyntheticEvent) => handleSubmit(executeAsync)(e),
		[handleSubmit, executeAsync]
	);

	const resetFormAndAction = React.useCallback(() => {
		resetForm();
		resetAction();
	}, [resetForm, resetAction]);

	return {
		action,
		form,
		handleSubmitWithAction,
		resetFormAndAction,
	};
}

export type * from "./hooks.types";
