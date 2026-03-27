import type { SafeActionFn } from "next-safe-action";
import type { HookCallbacks, UseActionHookReturn, UseOptimisticActionHookReturn } from "next-safe-action/hooks";
import type { UseFormProps, UseFormReturn } from "react-hook-form";
import type { ErrorMapperProps } from "./index.types";
import type { InferInputOrDefault, InferOutputOrDefault, StandardSchemaV1 } from "./standard-schema";

/**
 * Optional props for `useHookFormAction` and `useHookFormOptimisticAction`.
 */
export type HookProps<
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
	FormContext = any,
> = {
	errorMapProps?: ErrorMapperProps;
	actionProps?: HookCallbacks<ServerError, Schema, ShapedErrors, Data>;
	formProps?: Omit<
		UseFormProps<InferInputOrDefault<Schema, any>, FormContext, InferOutputOrDefault<Schema, any>>,
		"resolver"
	>;
};

/**
 * Type of the return object of the `useHookFormAction` hook.
 */
export type UseHookFormActionHookReturn<
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
	FormContext = any,
> = {
	action: UseActionHookReturn<ServerError, Schema, ShapedErrors, Data>;
	form: UseFormReturn<InferInputOrDefault<Schema, any>, FormContext, InferOutputOrDefault<Schema, any>>;
	handleSubmitWithAction: (e?: React.BaseSyntheticEvent) => Promise<void>;
	resetFormAndAction: () => void;
};

/**
 * Type of the return object of the `useHookFormOptimisticAction` hook.
 */
export type UseHookFormOptimisticActionHookReturn<
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
	State,
	FormContext = any,
> = Omit<UseHookFormActionHookReturn<ServerError, Schema, ShapedErrors, Data, FormContext>, "action"> & {
	action: UseOptimisticActionHookReturn<ServerError, Schema, ShapedErrors, Data, State>;
};

/**
 * Infer the type of the return object of the `useHookFormAction` hook.
 */
export type InferUseHookFormActionHookReturn<T extends Function, FormContext = any> =
	T extends SafeActionFn<
		infer ServerError,
		infer Schema extends StandardSchemaV1 | undefined,
		any,
		infer ShapedErrors,
		infer Data
	>
		? UseHookFormActionHookReturn<ServerError, Schema, ShapedErrors, Data, FormContext>
		: never;

/**
 * Infer the type of the return object of the `useHookFormOptimisticAction` hook.
 */
export type InferUseHookFormOptimisticActionHookReturn<T extends Function, State, FormContext = any> =
	T extends SafeActionFn<
		infer ServerError,
		infer Schema extends StandardSchemaV1 | undefined,
		any,
		infer ShapedErrors,
		infer Data
	>
		? UseHookFormOptimisticActionHookReturn<ServerError, Schema, ShapedErrors, Data, State, FormContext>
		: never;
