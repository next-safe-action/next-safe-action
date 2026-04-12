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
export type HookActionStatus = "idle" | "executing" | "hasSucceeded" | "hasErrored" | "hasNavigated";

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
 * Result shape when no action has completed yet (idle, executing, navigated).
 */
export type HookIdleResult = { data?: undefined; serverError?: undefined; validationErrors?: undefined };

/**
 * Result shape for the success branch. For void-returning actions, collapses to `HookIdleResult`
 * so that `result.data` is `undefined` rather than `void`.
 */
export type HookSuccessResult<Data> = [Data] extends [void]
	? HookIdleResult
	: { data: Data; serverError?: undefined; validationErrors?: undefined };

/**
 * Result shape for the error branch. Includes the idle shape for thrown errors
 * (where `result` is `{}` and the error is captured internally).
 */
export type HookErrorResult<ServerError, ShapedErrors> =
	| HookIdleResult
	| { data?: undefined; serverError: ServerError; validationErrors?: undefined }
	| { data?: undefined; serverError?: undefined; validationErrors: ShapedErrors };

/**
 * Common properties shared across all status branches of the hook return type.
 */
type HookResultCommon<ServerError, Schema extends StandardSchemaV1 | undefined, ShapedErrors, Data> = {
	execute: (input: InferInputOrDefault<Schema, void>) => void;
	executeAsync: (
		input: InferInputOrDefault<Schema, void>
	) => Promise<NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>>;
	input: InferInputOrDefault<Schema, undefined>;
	reset: () => void;
	isTransitioning: boolean;
};

/**
 * Type of the return object of the `useAction` hook.
 *
 * This is a discriminated union keyed on `status` and the shorthand boolean
 * properties (`hasSucceeded`, `hasErrored`, etc.). Checking any discriminant
 * narrows the `result` type:
 *
 * ```ts
 * const action = useAction(myAction);
 * if (action.hasSucceeded) {
 *   action.result.data        // Data (guaranteed)
 *   action.result.serverError // undefined
 * }
 * ```
 *
 * Destructured narrowing works too (TypeScript 4.6+):
 *
 * ```ts
 * const { status, result } = useAction(myAction);
 * if (status === "hasSucceeded") {
 *   result.data // narrowed to Data
 * }
 * ```
 *
 * `result` and `executeAsync` are run through `NormalizeActionResult` so that
 * void-returning actions expose `result.data: undefined` rather than `void | undefined`.
 */
export type UseActionHookReturn<ServerError, Schema extends StandardSchemaV1 | undefined, ShapedErrors, Data> =
	HookResultCommon<ServerError, Schema, ShapedErrors, Data> &
		(
			| {
					status: "idle";
					isIdle: true;
					isExecuting: false;
					isPending: boolean;
					hasSucceeded: false;
					hasErrored: false;
					hasNavigated: false;
					result: Prettify<HookIdleResult>;
			  }
			| {
					status: "executing";
					isIdle: false;
					isExecuting: true;
					isPending: true;
					hasSucceeded: false;
					hasErrored: false;
					hasNavigated: false;
					result: Prettify<NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>>;
			  }
			| {
					status: "hasSucceeded";
					isIdle: false;
					isExecuting: false;
					isPending: boolean;
					hasSucceeded: true;
					hasErrored: false;
					hasNavigated: false;
					result: Prettify<HookSuccessResult<Data>>;
			  }
			| {
					status: "hasErrored";
					isIdle: false;
					isExecuting: false;
					isPending: boolean;
					hasSucceeded: false;
					hasErrored: true;
					hasNavigated: false;
					result: Prettify<HookErrorResult<ServerError, ShapedErrors>>;
			  }
			| {
					status: "hasNavigated";
					isIdle: false;
					isExecuting: false;
					isPending: boolean;
					hasSucceeded: false;
					hasErrored: false;
					hasNavigated: true;
					result: Prettify<HookIdleResult>;
			  }
		);

/**
 * Type of the return object of the `useOptimisticAction` hook.
 * Extends `UseActionHookReturn` with `optimisticState`. TypeScript distributes
 * the intersection over the union, preserving the discriminated union narrowing.
 */
export type UseOptimisticActionHookReturn<
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
	State,
> = UseActionHookReturn<ServerError, Schema, ShapedErrors, Data> & {
	optimisticState: State;
};

/**
 * Type of the return object of the `useStateAction` hook.
 * Extends `UseActionHookReturn` with `formAction` for `<form action={formAction}>` integration.
 * TypeScript distributes the intersection over the union, preserving the discriminated union narrowing.
 */
export type UseStateActionHookReturn<
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
> = UseActionHookReturn<ServerError, Schema, ShapedErrors, Data> & {
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
