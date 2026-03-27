"use client";

import type { ValidationErrors } from "next-safe-action";
import type { SingleInputActionFn } from "next-safe-action/hooks";
import { useAction, useOptimisticAction } from "next-safe-action/hooks";
import * as React from "react";
import type { Resolver } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { HookProps, UseHookFormActionHookReturn, UseHookFormOptimisticActionHookReturn } from "./hooks.types";
import type { ErrorMapperProps } from "./index";
import { mapToHookFormErrors } from "./index";
import type { InferInputOrDefault, InferOutputOrDefault, StandardSchemaV1 } from "./standard-schema";

// ─── Error Mapper Hook ──────────────────────────────────────────────

/**
 * For more advanced use cases where you want full customization of the hooks used, you can
 * use this hook to map a validation errors object to a `FieldErrors` compatible with react-hook-form.
 * You can then pass the returned `hookFormValidationErrors` property to `useForm`'s `errors` prop.
 *
 * @param validationErrors Validation errors object from `next-safe-action`
 * @returns Object of `FieldErrors` compatible with react-hook-form
 */
export function useHookFormActionErrorMapper<Schema extends StandardSchemaV1 | undefined>(
	validationErrors: ValidationErrors<Schema> | undefined,
	props?: ErrorMapperProps
) {
	const hookFormValidationErrors = React.useMemo(
		() => mapToHookFormErrors<Schema>(validationErrors, props),
		[validationErrors, props]
	);

	return {
		hookFormValidationErrors,
	};
}

// ─── Shared Form Integration ────────────────────────────────────────

/**
 * Internal helper that wires up a safe action result with react-hook-form.
 * Extracts the common logic shared by `useHookFormAction` and `useHookFormOptimisticAction`.
 */
function useFormIntegration<Schema extends StandardSchemaV1 | undefined, FormContext>(
	action: { result: { validationErrors?: unknown }; executeAsync: (...args: any[]) => any; reset: () => void },
	hookFormResolver: Resolver<InferInputOrDefault<Schema, any>, FormContext, InferOutputOrDefault<Schema, any>>,
	props?: {
		errorMapProps?: ErrorMapperProps;
		formProps?: Record<string, any>;
	}
) {
	const { hookFormValidationErrors } = useHookFormActionErrorMapper<Schema>(
		action.result.validationErrors as ValidationErrors<Schema> | undefined,
		props?.errorMapProps
	);

	const form = useForm<InferInputOrDefault<Schema, any>, FormContext, InferOutputOrDefault<Schema, any>>({
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

	return { form, handleSubmitWithAction, resetFormAndAction };
}

// ─── Public Hooks ───────────────────────────────────────────────────

/**
 * This hook is a wrapper around `useAction` and `useForm` that makes it easier to use safe actions
 * with react-hook-form. It also maps validation errors to `FieldErrors` compatible with react-hook-form.
 *
 * @param safeAction The safe action
 * @param hookFormResolver A react-hook-form validation resolver
 * @param props Optional props for both `useAction`, `useForm` hooks and error mapper
 * @returns An object containing `action` and `form` controllers, `handleSubmitWithAction`, and `resetFormAndAction`
 */
export function useHookFormAction<
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
	FormContext = any,
>(
	safeAction: SingleInputActionFn<ServerError, Schema, ShapedErrors, Data>,
	hookFormResolver: Resolver<InferInputOrDefault<Schema, any>, FormContext, InferOutputOrDefault<Schema, any>>,
	props?: HookProps<ServerError, Schema, ShapedErrors, Data, FormContext>
): UseHookFormActionHookReturn<ServerError, Schema, ShapedErrors, Data, FormContext> {
	const action = useAction(safeAction, props?.actionProps);
	const { form, handleSubmitWithAction, resetFormAndAction } = useFormIntegration<Schema, FormContext>(
		action,
		hookFormResolver,
		props
	);

	return { action, form, handleSubmitWithAction, resetFormAndAction };
}

/**
 * This hook is a wrapper around `useOptimisticAction` and `useForm` that makes it easier to use safe actions
 * with react-hook-form. It also maps validation errors to `FieldErrors` compatible with react-hook-form.
 *
 * @param safeAction The safe action
 * @param hookFormResolver A react-hook-form validation resolver
 * @param props Required `currentState` and `updateFn` props for the action, and additional optional
 * props for both `useAction`, `useForm` hooks and error mapper
 * @returns An object containing `action` and `form` controllers, `handleSubmitWithAction`, and `resetFormAndAction`
 */
export function useHookFormOptimisticAction<
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
	State,
	FormContext = any,
>(
	safeAction: SingleInputActionFn<ServerError, Schema, ShapedErrors, Data>,
	hookFormResolver: Resolver<InferInputOrDefault<Schema, any>, FormContext, InferOutputOrDefault<Schema, any>>,
	props: HookProps<ServerError, Schema, ShapedErrors, Data, FormContext> & {
		actionProps: {
			currentState: State;
			updateFn: (state: State, input: InferInputOrDefault<Schema, void>) => State;
		};
	}
): UseHookFormOptimisticActionHookReturn<ServerError, Schema, ShapedErrors, Data, State, FormContext> {
	const action = useOptimisticAction(safeAction, props.actionProps);
	const { form, handleSubmitWithAction, resetFormAndAction } = useFormIntegration<Schema, FormContext>(
		action,
		hookFormResolver,
		props
	);

	return { action, form, handleSubmitWithAction, resetFormAndAction };
}

export type * from "./hooks.types";
