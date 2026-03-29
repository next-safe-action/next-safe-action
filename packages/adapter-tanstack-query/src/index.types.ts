import type { UseMutationOptions } from "@tanstack/react-query";
import type { SafeActionFn } from "next-safe-action";
import type { SingleInputActionFn } from "next-safe-action/hooks";
import type { ActionMutationError } from "./errors";
import type { InferInputOrDefault, StandardSchemaV1 } from "./standard-schema";

/**
 * Options accepted by the `mutationOptions` factory as the second parameter.
 * All TanStack Query mutation options are accepted except `mutationFn`, which is
 * provided by the factory.
 */
export type MutationOptionsOpts<
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
	TOnMutateResult = unknown,
> = Omit<
	UseMutationOptions<
		Data,
		ActionMutationError<ServerError, ShapedErrors>,
		InferInputOrDefault<Schema, void>,
		TOnMutateResult
	>,
	"mutationFn"
>;

/**
 * The complete `UseMutationOptions` object returned by the `mutationOptions` factory.
 */
export type MutationOptionsReturn<
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
	TOnMutateResult = unknown,
> = UseMutationOptions<
	Data,
	ActionMutationError<ServerError, ShapedErrors>,
	InferInputOrDefault<Schema, void>,
	TOnMutateResult
> & {
	/** Always provided by the `mutationOptions` factory. */
	mutationFn: NonNullable<
		UseMutationOptions<
			Data,
			ActionMutationError<ServerError, ShapedErrors>,
			InferInputOrDefault<Schema, void>,
			TOnMutateResult
		>["mutationFn"]
	>;
};

/**
 * Infer the `UseMutationOptions` type from a safe action function.
 *
 * @example
 * ```typescript
 * type Opts = InferMutationOptions<typeof myAction>;
 * ```
 */
export type InferMutationOptions<T extends Function, TOnMutateResult = unknown> = T extends
	| SafeActionFn<
			infer ServerError,
			infer Schema extends StandardSchemaV1 | undefined,
			any,
			infer ShapedErrors,
			infer Data
	  >
	| SingleInputActionFn<
			infer ServerError,
			infer Schema extends StandardSchemaV1 | undefined,
			infer ShapedErrors,
			infer Data
	  >
	? MutationOptionsReturn<ServerError, Schema, ShapedErrors, Data, TOnMutateResult>
	: never;

/**
 * Infer the `ActionMutationError` type from a safe action function.
 *
 * @example
 * ```typescript
 * type Err = InferActionMutationError<typeof myAction>;
 * ```
 */
export type InferActionMutationError<T extends Function> = T extends
	| SafeActionFn<infer ServerError, infer _Schema extends StandardSchemaV1 | undefined, any, infer ShapedErrors, any>
	| SingleInputActionFn<infer ServerError, infer _Schema extends StandardSchemaV1 | undefined, infer ShapedErrors, any>
	? ActionMutationError<ServerError, ShapedErrors>
	: never;
