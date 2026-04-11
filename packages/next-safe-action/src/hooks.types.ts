import type {
	NavigationKind,
	NormalizeActionResult,
	SafeActionFn,
	SafeActionResult,
	SafeStateActionFn,
} from "./index.types";
import type { InferInputOrDefault, StandardSchemaV1 } from "./standard-schema";
import type { MaybePromise, Prettify } from "./utils.types";

/**
 * Hook options: configuration + lifecycle callbacks.
 *
 * When `throwOnNavigation` is `true`, `onNavigation` and `onSettled` callbacks are not available
 * because the render-phase throw prevents React from committing effects. This is a fundamental
 * constraint of React's rendering model: when a component throws during render, the commit phase
 * (where effects run) is never reached.
 *
 * Use server-side action callbacks for guaranteed navigation side effects.
 */
export type HookBaseOptions<ServerError, Schema extends StandardSchemaV1 | undefined, ShapedErrors, Data> =
	| ({ throwOnNavigation?: false } & HookCallbacks<ServerError, Schema, ShapedErrors, Data>)
	| ({ throwOnNavigation: true } & Omit<
			HookCallbacks<ServerError, Schema, ShapedErrors, Data>,
			"onNavigation" | "onSettled"
	  >);

/**
 * Type of hooks callbacks. These are executed when action is in a specific state.
 */
export type HookCallbacks<ServerError, Schema extends StandardSchemaV1 | undefined, ShapedErrors, Data> = {
	onExecute?: (args: { input: InferInputOrDefault<Schema, undefined> }) => MaybePromise<unknown>;
	onSuccess?: (args: { data: Data; input: InferInputOrDefault<Schema, undefined> }) => MaybePromise<unknown>;
	onError?: (args: {
		error: Prettify<Omit<SafeActionResult<ServerError, Schema, ShapedErrors, Data>, "data">> & { thrownError?: Error };
		input: InferInputOrDefault<Schema, undefined>;
	}) => MaybePromise<unknown>;
	onNavigation?: (args: {
		input: InferInputOrDefault<Schema, undefined>;
		navigationKind: NavigationKind;
	}) => MaybePromise<unknown>;
	onSettled?: (args: {
		result: Prettify<NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>>;
		input: InferInputOrDefault<Schema, undefined>;
		navigationKind?: NavigationKind;
	}) => MaybePromise<unknown>;
};

/**
 * Type of the safe action function passed to hooks. Same as `SafeActionFn` except it accepts
 * just a single input, without bind arguments.
 */
export type SingleInputActionFn<ServerError, Schema extends StandardSchemaV1 | undefined, ShapedErrors, Data> = (
	input: InferInputOrDefault<Schema, undefined>
) => Promise<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>;

/**
 * Type of the stateful safe action function passed to hooks. Same as `SafeStateActionFn` except it accepts
 * just a single input, without bind arguments.
 */
export type SingleInputStateActionFn<ServerError, Schema extends StandardSchemaV1 | undefined, ShapedErrors, Data> = (
	prevResult: SafeActionResult<ServerError, Schema, ShapedErrors, Data>,
	input: InferInputOrDefault<Schema, undefined>
) => Promise<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>;

/**
 * Type of the action status returned by `useAction`, `useOptimisticAction` and `useStateAction` hooks.
 */
export type HookActionStatus = "idle" | "executing" | "transitioning" | "hasSucceeded" | "hasErrored" | "hasNavigated";

/**
 * Type of the shorthand status object returned by `useAction`, `useOptimisticAction` and `useStateAction` hooks.
 */
export type HookShorthandStatus = {
	isIdle: boolean;
	isExecuting: boolean;
	isTransitioning: boolean;
	isPending: boolean;
	hasSucceeded: boolean;
	hasErrored: boolean;
	hasNavigated: boolean;
};

/**
 * Type of the return object of the `useAction` hook.
 *
 * `result` and `executeAsync` are run through `NormalizeActionResult` so that
 * void-returning actions expose `result.data: undefined` rather than `void | undefined`,
 * matching the `await action()` shape from `SafeActionFn`.
 */
export type UseActionHookReturn<ServerError, Schema extends StandardSchemaV1 | undefined, ShapedErrors, Data> = {
	execute: (input: InferInputOrDefault<Schema, void>) => void;
	executeAsync: (
		input: InferInputOrDefault<Schema, void>
	) => Promise<NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>>;
	input: InferInputOrDefault<Schema, undefined>;
	result: Prettify<NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>>;
	reset: () => void;
	status: HookActionStatus;
} & HookShorthandStatus;

/**
 * Type of the return object of the `useOptimisticAction` hook.
 */
export type UseOptimisticActionHookReturn<
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
	State,
> = UseActionHookReturn<ServerError, Schema, ShapedErrors, Data> &
	HookShorthandStatus & {
		optimisticState: State;
	};

/**
 * Type of the return object of the `useStateAction` hook.
 * Extends `UseActionHookReturn` with `formAction` for `<form action={formAction}>` integration.
 */
export type UseStateActionHookReturn<
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
> = UseActionHookReturn<ServerError, Schema, ShapedErrors, Data> &
	HookShorthandStatus & {
		formAction: (input: InferInputOrDefault<Schema, void>) => void;
	};

/**
 * Type of the return object of the `useAction` hook.
 */
export type InferUseActionHookReturn<T extends Function> =
	T extends SafeActionFn<
		infer ServerError,
		infer Schema extends StandardSchemaV1 | undefined,
		any,
		infer ShapedErrors,
		infer Data
	>
		? UseActionHookReturn<ServerError, Schema, ShapedErrors, Data>
		: never;

/**
 * Type of the return object of the `useOptimisticAction` hook.
 */
export type InferUseOptimisticActionHookReturn<T extends Function, State = any> =
	T extends SafeActionFn<
		infer ServerError,
		infer Schema extends StandardSchemaV1 | undefined,
		any,
		infer ShapedErrors,
		infer Data
	>
		? UseOptimisticActionHookReturn<ServerError, Schema, ShapedErrors, Data, State>
		: never;

/**
 * Type of the return object of the `useStateAction` hook.
 */
export type InferUseStateActionHookReturn<T extends Function> =
	T extends SafeStateActionFn<
		infer ServerError,
		infer Schema extends StandardSchemaV1 | undefined,
		any,
		infer ShapedErrors,
		infer Data
	>
		? UseStateActionHookReturn<ServerError, Schema, ShapedErrors, Data>
		: never;

/**
 * Deprecated aliases kept for backward compatibility.
 */

/**
 * @deprecated Use `SingleInputActionFn` instead.
 */
export type HookSafeActionFn<
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
> = SingleInputActionFn<ServerError, Schema, ShapedErrors, Data>;

/**
 * @deprecated Use `SingleInputStateActionFn` instead.
 */
export type HookSafeStateActionFn<
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
> = SingleInputStateActionFn<ServerError, Schema, ShapedErrors, Data>;
