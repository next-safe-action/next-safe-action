"use client";

import * as React from "react";
import { useActionBase } from "./hooks-shared";
import { getActionShorthandStatusObject, getActionStatus, useActionCallbacks } from "./hooks-utils";
import type {
	HookBaseOptions,
	HookCallbacks,
	HookIdleResult,
	SingleInputActionFn,
	SingleInputStateActionFn,
	UseActionHookReturn,
	UseOptimisticActionHookReturn,
	UseOptimisticStateActionHookReturn,
	UseStateActionHookReturn,
} from "./hooks.types";
import type { NormalizeActionResult, SafeActionResult } from "./index.types";
import { FrameworkErrorHandler } from "./next/errors";
import type { InferInputOrDefault, StandardSchemaV1 } from "./standard-schema";

// Fire-and-forget delivery for a user callback, matching `useActionCallbacks`: a callback may be
// async, and a rejection must never take down the dispatch that triggered it.
//
// The `try` is not redundant with the `.catch`: `Promise.resolve(cb(arg))` evaluates `cb(arg)`
// first, so a *synchronous* throw escapes before there is a promise to catch it on. That throw
// would surface in whichever caller is on the stack -- from `onTransitionStart` it escapes before
// the resolver entry is enqueued and the dispatcher runs, stranding `executeAsync` forever; from
// `onDispatchSettled` it escapes inside `wrappedAction` and turns a successful server result into
// a rejected action.
function fireCallback<A>(cb: ((arg: A) => unknown) | undefined, arg: A) {
	if (!cb) return;

	try {
		Promise.resolve(cb(arg)).catch(console.error);
	} catch (e) {
		console.error(e);
	}
}

// HOOKS

/**
 * Use the action from a Client Component via hook.
 * @param safeActionFn The action function
 * @param opts Optional configuration: `initResult` for initial state, plus callbacks
 *
 * {@link https://next-safe-action.dev/docs/execute-actions/hooks/useaction See docs for more information}
 */
export const useAction = <
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
	InitR extends SafeActionResult<ServerError, Schema, ShapedErrors, Data> = HookIdleResult,
>(
	safeActionFn: SingleInputActionFn<ServerError, Schema, ShapedErrors, Data>,
	opts?: {
		initResult?: InitR;
	} & HookBaseOptions<ServerError, Schema, ShapedErrors, Data>
): UseActionHookReturn<ServerError, Schema, ShapedErrors, Data, InitR> => {
	const { result, clientInput, status, execute, executeAsync, reset, shorthandStatus } = useActionBase(
		safeActionFn,
		opts
	);

	// Cast rationale: the return object's runtime values are guaranteed consistent
	// by `getActionStatus` + `getActionShorthandStatusObject`, but TypeScript can't
	// verify that the widened types (e.g. `status: HookActionStatus`) satisfy a
	// specific branch of the discriminated union. The cast is safe and isolated here.
	return {
		execute,
		executeAsync,
		input: clientInput as InferInputOrDefault<Schema, undefined>,
		result,
		reset,
		status,
		...shorthandStatus,
	} as UseActionHookReturn<ServerError, Schema, ShapedErrors, Data, InitR>;
};

/**
 * Use the action from a Client Component via hook, with optimistic data update.
 * @param safeActionFn The action function
 * @param utils Required `currentData` and `updateFn`, optional `initResult` for initial state, and optional callbacks
 *
 * {@link https://next-safe-action.dev/docs/execute-actions/hooks/useoptimisticaction See docs for more information}
 */
export const useOptimisticAction = <
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
	State,
	InitR extends SafeActionResult<ServerError, Schema, ShapedErrors, Data> = HookIdleResult,
>(
	safeActionFn: SingleInputActionFn<ServerError, Schema, ShapedErrors, Data>,
	utils: {
		currentState: State;
		updateFn: (state: State, input: InferInputOrDefault<Schema, void>) => State;
		initResult?: InitR;
	} & HookBaseOptions<ServerError, Schema, ShapedErrors, Data>
): UseOptimisticActionHookReturn<ServerError, Schema, ShapedErrors, Data, State, InitR> => {
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

	// Cast rationale: same as `useAction` — runtime consistency guaranteed by
	// `getActionStatus` + `getActionShorthandStatusObject`. The double assertion
	// is needed because TypeScript can't verify overlap between the widened object
	// and the distributed intersection-over-union (`UseActionHookReturn & { optimisticState }`).
	return {
		execute,
		executeAsync,
		input: clientInput as InferInputOrDefault<Schema, undefined>,
		result,
		optimisticState,
		reset,
		status,
		...shorthandStatus,
	} as unknown as UseOptimisticActionHookReturn<ServerError, Schema, ShapedErrors, Data, State, InitR>;
};

/**
 * Enforces the contract documented on `UseOptimisticStateActionHookReturn`: when the action
 * returns data, that data IS the full next confirmed state, because the hook adopts it as the
 * confirmed value and hands it to the next queued dispatch as `prevResult`.
 *
 * An action that returns nothing is exempt, which is what the pending-changes-list shape relies
 * on: there `Data` is `void` and `State` is an unrelated list of pending changes.
 *
 * Intersected onto the `utils` parameter rather than applied as a generic constraint, so `State`
 * keeps its inference site on `currentState` and `Data` stays inferred from the action.
 */
type ActionDataFitsState<Data, State> = [Data] extends [State | void] ? unknown : never;

/**
 * Internal seams that let `useOptimisticStateAction` layer optimistic domain state on top of
 * `useStateActionInternal` without a second copy of its concurrency machinery. Not public: the
 * exported `useStateAction` never passes them.
 */
type StateActionStrategies<ServerError, Schema extends StandardSchemaV1 | undefined, ShapedErrors, Data> = {
	/**
	 * Runs inside the dispatch transition, before `dispatcher`. Used to apply the optimistic update.
	 * `dispatchId` identifies this dispatch among the ones the queue is holding, so a consumer can
	 * tell an optimistic payload apart from the payloads around it in the queue.
	 */
	onTransitionStart?: (input: InferInputOrDefault<Schema, undefined>, generation: number, dispatchId: number) => void;
	/**
	 * Substitutes the `prevResult` handed to the server action. Lets the optimistic hook replace an
	 * error envelope with the last confirmed domain state, so one failed dispatch can't poison the
	 * rest of the queue.
	 */
	resolvePrevResult?: (
		prevResult: SafeActionResult<ServerError, Schema, ShapedErrors, Data>
	) => SafeActionResult<ServerError, Schema, ShapedErrors, Data>;
	/**
	 * Runs once per settled dispatch, inside `wrappedAction`. This is the only place intermediate
	 * queue results are observable: React withholds `useActionState` commits until the whole queue
	 * drains, so `result` and `status` cannot report them.
	 */
	onDispatchSettled?: (
		outcome: {
			result?: SafeActionResult<ServerError, Schema, ShapedErrors, Data>;
			navigationError?: Error;
			thrownError?: Error;
		},
		input: InferInputOrDefault<Schema, undefined>,
		dispatchId: number
	) => void;
	/**
	 * Runs synchronously inside `reset`, before the state updates are applied. Receives the reset
	 * generation the internal hook just moved to, so a consumer's own generation state can never
	 * fall behind it: two `reset()` calls batched before a render bump the internal counter twice,
	 * while a consumer deriving `previous + 1` from rendered state would only reach one.
	 */
	onReset?: (generation: number) => void;
	/** Skips the shared effect-driven callbacks, for hooks that fire their own per-dispatch ones. */
	suppressCallbacks?: boolean;
};

/**
 * Shared implementation behind `useStateAction` and `useOptimisticStateAction`.
 *
 * Owns every concurrency invariant of the stateful path: the FIFO resolver
 * queue that keeps `executeAsync` promises aligned with dispatch order, the reset generation that
 * marks uncancellable in-flight dispatches stale, the `queueMicrotask` double-apply that keeps a
 * dispatch visible inside an ambient transition, and the reset masking of `useActionState`'s
 * pending flag. `strategies` is the only extension point; the exported `useStateAction` passes none.
 */
const useStateActionInternal = <
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
	InitR extends SafeActionResult<ServerError, Schema, ShapedErrors, Data> = HookIdleResult,
>(
	safeActionFn: SingleInputStateActionFn<ServerError, Schema, ShapedErrors, Data>,
	opts?: {
		initResult?: InitR;
	} & HookBaseOptions<ServerError, Schema, ShapedErrors, Data>,
	strategies?: StateActionStrategies<ServerError, Schema, ShapedErrors, Data>
): UseStateActionHookReturn<ServerError, Schema, ShapedErrors, Data, InitR> => {
	// ─── Refs ────────────────────────────────────────────────────────────

	// `initResult` is captured once at mount, mirroring React's `useActionState` initialState:
	// later changes to the option are ignored, and `reset` restores this baseline.
	const initResultRef = React.useRef<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>(opts?.initResult ?? {});

	// FIFO queue aligned with dispatch order: `useActionState` runs queued actions sequentially,
	// and every dispatch path enqueues exactly one entry (a resolver for `executeAsync`, `null`
	// for `execute`/`formAction`), so `wrappedAction` settles the right promise by shifting one
	// entry per invocation. A single slot would be overwritten by overlapping `executeAsync`
	// calls, leaving the first promise unsettled. Each entry also records the reset generation
	// at dispatch time, so dispatches enqueued before a `reset` are detected as stale.
	const asyncResolversRef = React.useRef<
		Array<{
			resolver: {
				resolve: (value: unknown) => void;
				reject: (reason: unknown) => void;
			} | null;
			generation: number;
			dispatchId: number;
		}>
	>([]);
	const prevResultOverrideRef = React.useRef<SafeActionResult<ServerError, Schema, ShapedErrors, Data> | null>(null);
	// Incremented on every `reset`: dispatches carrying an older generation must not clear the
	// reset state nor consume the reset baseline (`useActionState` dispatches can't be cancelled).
	const resetGenerationRef = React.useRef(0);
	// Bumped once per dispatch, so each dispatch can be told apart from the commits it produces.
	const dispatchIdRef = React.useRef(0);

	// Mutable ref assigned every render, so passing strategies never destabilizes the
	// `useCallback` deps of `wrappedAction` / `dispatchWithResolver` / `formAction`.
	const strategiesRef = React.useRef(strategies);
	strategiesRef.current = strategies;

	// ─── State ────────────────────────────────────────────────────────────

	const [navigationError, setNavigationError] = React.useState<Error | null>(null);
	const [thrownError, setThrownError] = React.useState<Error | null>(null);
	const [isIdle, setIsIdle] = React.useState(true);
	const [isReset, setIsReset] = React.useState(false);
	// Identifies the dispatch the committed state belongs to; `0` means none yet. Set inside the
	// dispatch-time batch so it can never advance ahead of the state it describes.
	const [executionId, setExecutionId] = React.useState(0);
	const [clientInput, setClientInput] = React.useState<InferInputOrDefault<Schema, void>>();
	const [isTransitioning, startTransition] = React.useTransition();

	// Shared dispatch-time state initialization: every dispatch path (`execute`,
	// `executeAsync`, `formAction`) runs this before enqueueing its action, so the
	// visible state always reflects the latest dispatched input.
	//
	// Applied twice, on purpose. The synchronous call is what normally commits. A dispatch
	// made inside an ambient React transition (`<form action={formAction}>`, where React sets
	// its internal current transition before calling the action) puts these updates on the
	// transition lane instead, and Next's router suspends on that same lane while it awaits
	// the RSC response: nothing commits until the action settles. `isReset` staying true then
	// keeps `isExecutingMasked` false, so the whole dispatch after a `reset` reports idle.
	//
	// A microtask runs after React restores the current transition in `startTransition`'s
	// `finally`, so the repeat lands on the default lane and commits right away. Outside a
	// transition it is an eager bailout: same values, no extra render.
	const beginDispatch = React.useCallback((input: InferInputOrDefault<Schema, void>) => {
		const generation = resetGenerationRef.current;
		const dispatchId = ++dispatchIdRef.current;

		const apply = () => {
			setIsIdle(false);
			setIsReset(false);
			setNavigationError(null);
			setThrownError(null);
			setClientInput(input);
			setExecutionId(dispatchId);
		};

		apply();

		queueMicrotask(() => {
			// A `reset` landed in between: its state must win.
			if (generation !== resetGenerationRef.current) return;
			apply();
		});
	}, []);

	// ─── Wrapper function ─────────────────────────────────────────────────
	// State updates inside the wrapper run after an `await`, so React does not treat them as part
	// of the transition: they commit on the default lane right away, before `useActionState`
	// commits the result and clears its pending flag. `useActionCallbacks` dedupes the navigation
	// callbacks across those two commits.

	const wrappedAction = React.useCallback(
		async (
			prevResult: SafeActionResult<ServerError, Schema, ShapedErrors, Data>,
			input: InferInputOrDefault<Schema, undefined>
		): Promise<SafeActionResult<ServerError, Schema, ShapedErrors, Data>> => {
			// One dispatch = one queue entry, consumed here in dispatch order.
			const entry = asyncResolversRef.current.shift();
			const asyncResolver = entry?.resolver ?? null;
			const dispatchGeneration = entry?.generation ?? resetGenerationRef.current;
			const dispatchId = entry?.dispatchId ?? dispatchIdRef.current;
			// Re-evaluated at each use: a `reset` can land while this action is awaited.
			const staleAfterReset = () => dispatchGeneration !== resetGenerationRef.current;

			// A `reset` landed while this dispatch was still queued behind another one, so it has
			// not reached the server yet. React cannot cancel an enqueued `useActionState` action,
			// but nothing has been sent, so the write can still be skipped -- and must be. The hook
			// already discards a stale dispatch's result, callbacks and errors, so running it would
			// perform a mutation the user asked to discard and that the hook then hides: the write
			// lands, and a `revalidatePath` inside it later overwrites the reset baseline with an
			// order the user never saw. Only the dispatch that had already reached the server when
			// the `reset` ran survives it, because that one genuinely cannot be recalled.
			if (staleAfterReset()) {
				asyncResolver?.resolve({});
				return {};
			}

			const basePrevResult = prevResultOverrideRef.current ?? prevResult;
			prevResultOverrideRef.current = null;

			// Applied after the reset override so a `reset` still wins: the override carries the
			// mount baseline, which is already the confirmed state the strategy would substitute.
			const effectivePrevResult = strategiesRef.current?.resolvePrevResult?.(basePrevResult) ?? basePrevResult;

			try {
				// Never store `undefined`, mirroring `useActionBase`'s `setResult(res ?? {})`. The
				// render-time `rawResult ?? {}` below would otherwise allocate a fresh object on every
				// render, and `useActionCallbacks` compares result identity to tell a new execution
				// from a replay, so `onSuccess`/`onSettled` would re-fire on every unrelated re-render.
				const result = (await safeActionFn(effectivePrevResult, input)) ?? {};
				if (!staleAfterReset()) {
					strategiesRef.current?.onDispatchSettled?.({ result }, input, dispatchId);
				}
				asyncResolver?.resolve(result);
				return result;
			} catch (e) {
				if (FrameworkErrorHandler.isNavigationError(e)) {
					if (!staleAfterReset()) {
						setNavigationError(e);
						strategiesRef.current?.onDispatchSettled?.({ navigationError: e }, input, dispatchId);
					}
					asyncResolver?.reject(e);
					return {};
				}

				asyncResolver?.reject(e);

				// A stale (pre-reset) dispatch must not rethrow. React tears down its whole action
				// queue when an Action rejects, so rethrowing here would cancel the fresh dispatches
				// that were queued *after* the `reset` and are still waiting to run. The reset
				// already made this dispatch's outcome invisible, so swallowing it costs nothing.
				if (staleAfterReset()) {
					return {};
				}

				setThrownError(e as Error);
				strategiesRef.current?.onDispatchSettled?.({ thrownError: e as Error }, input, dispatchId);

				// This throw reaches an error boundary, and React drops every action still queued
				// behind it without ever invoking `wrappedAction` for them. Their `executeAsync`
				// promises would then never settle, so reject them here, in dispatch order.
				for (const queued of asyncResolversRef.current.splice(0)) {
					queued.resolver?.reject(e);
				}

				throw e;
			}
		},
		[safeActionFn]
	);

	// ─── Core useActionState ──────────────────────────────────────────────

	const [rawResult, dispatcher, isExecuting] = React.useActionState(wrappedAction, initResultRef.current);

	// ─── execute ──────────────────────────────────────────────────────────

	const dispatchWithResolver = React.useCallback(
		(
			input: InferInputOrDefault<Schema, void>,
			asyncResolver: { resolve: (value: unknown) => void; reject: (reason: unknown) => void } | null
		) => {
			beginDispatch(input);

			startTransition(() => {
				// Must run inside this transition: React only holds an optimistic value for as long
				// as the Action that scheduled it is pending.
				strategiesRef.current?.onTransitionStart?.(
					input as InferInputOrDefault<Schema, undefined>,
					resetGenerationRef.current,
					dispatchIdRef.current
				);
				asyncResolversRef.current.push({
					resolver: asyncResolver,
					generation: resetGenerationRef.current,
					dispatchId: dispatchIdRef.current,
				});
				dispatcher(input as InferInputOrDefault<Schema, undefined>);
			});
		},
		[beginDispatch, dispatcher]
	);

	const execute = React.useCallback(
		(input: InferInputOrDefault<Schema, void>) => {
			dispatchWithResolver(input, null);
		},
		[dispatchWithResolver]
	);

	// ─── executeAsync ─────────────────────────────────────────────────────

	const executeAsync = React.useCallback(
		(input: InferInputOrDefault<Schema, void>) => {
			return new Promise<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>((resolve, reject) => {
				dispatchWithResolver(input, {
					resolve: resolve as (value: unknown) => void,
					reject,
				});
			});
		},
		[dispatchWithResolver]
	);

	// ─── formAction ───────────────────────────────────────────────────────

	// Wraps the dispatcher so form dispatches also initialize state at dispatch time and
	// enqueue their (null) entry, keeping the resolver queue aligned with dispatch order
	// when `formAction` and `executeAsync` interleave. React invokes form actions inside its
	// own transition, which is exactly the case `beginDispatch`'s microtask repeat covers.
	const formAction = React.useCallback(
		(input: InferInputOrDefault<Schema, undefined>) => {
			beginDispatch(input as InferInputOrDefault<Schema, void>);
			// React already supplies the transition on this path, so the seam is called directly.
			strategiesRef.current?.onTransitionStart?.(input, resetGenerationRef.current, dispatchIdRef.current);
			asyncResolversRef.current.push({
				resolver: null,
				generation: resetGenerationRef.current,
				dispatchId: dispatchIdRef.current,
			});
			dispatcher(input);
		},
		[beginDispatch, dispatcher]
	);

	// ─── reset ────────────────────────────────────────────────────────────

	const reset = React.useCallback(() => {
		// Mark every dispatch enqueued so far as stale (see `resetGenerationRef`).
		const generation = ++resetGenerationRef.current;
		prevResultOverrideRef.current = initResultRef.current;
		strategiesRef.current?.onReset?.(generation);

		const apply = () => {
			setIsIdle(true);
			setIsReset(true);
			setNavigationError(null);
			setThrownError(null);
			setClientInput(undefined);
		};

		// Same two-step dispatch as `beginDispatch`: a `reset` called from inside an ambient
		// transition would otherwise be withheld for as long as a dispatch is.
		apply();

		queueMicrotask(() => {
			// A newer `reset` landed in between: its state must win. A dispatch enqueued after
			// this reset keeps the same generation, and its own microtask runs after this one.
			if (generation !== resetGenerationRef.current) return;
			apply();
		});
	}, []);

	// ─── Status ───────────────────────────────────────────────────────────

	// On reset, the visible `result` is restored to the mount-captured `initResult` (or `{}` when
	// not provided) so the idle branch's runtime value matches its declared type in both phases:
	// at mount and after reset. This is also the intuitive contract for `reset`: return to the
	// initial state.
	const result = isReset ? initResultRef.current : (rawResult ?? {});

	// `useActionState`'s pending flag can't be cancelled: after a mid-flight `reset` it stays
	// true until the stale dispatch settles. Mask it with `isReset` so the reported status reads
	// idle immediately; the mask lifts on the next dispatch (`beginDispatch`).
	const isExecutingMasked = isExecuting && !isReset;

	const status = getActionStatus<ServerError, Schema, ShapedErrors, Data>({
		isExecuting: isExecutingMasked,
		result,
		isIdle: isIdle && !isExecutingMasked,
		hasNavigated: navigationError !== null,
		hasThrownError: thrownError !== null,
	});

	// ─── Callbacks ────────────────────────────────────────────────────────

	useActionCallbacks({
		result,
		input: clientInput as InferInputOrDefault<Schema, undefined>,
		status,
		executionId,
		cb: strategies?.suppressCallbacks
			? undefined
			: (opts as HookCallbacks<ServerError, Schema, ShapedErrors, Data> | undefined),
		throwOnNavigation: opts?.throwOnNavigation === true,
		navigationError,
		thrownError,
	});

	if (opts?.throwOnNavigation === true && navigationError !== null) {
		throw navigationError;
	}

	// ─── Return ───────────────────────────────────────────────────────────

	// Cast rationale: same as `useAction` — runtime consistency guaranteed by
	// `getActionStatus` + `getActionShorthandStatusObject`. The double assertion
	// through `unknown` is needed because TypeScript can't verify overlap between
	// the widened object and the distributed intersection-over-union.
	return {
		execute,
		executeAsync: executeAsync as unknown as (
			input: InferInputOrDefault<Schema, void>
		) => Promise<NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>>,
		formAction: formAction as (input: InferInputOrDefault<Schema, void>) => void,
		input: clientInput as InferInputOrDefault<Schema, undefined>,
		result: result as unknown as NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>,
		reset,
		status,
		...getActionShorthandStatusObject({ status, isTransitioning }),
	} as unknown as UseStateActionHookReturn<ServerError, Schema, ShapedErrors, Data, InitR>;
};

/**
 * Use the stateful action from a Client Component via hook. Used for actions defined with
 * [`stateAction`](https://next-safe-action.dev/docs/define-actions/instance-methods#action--stateaction).
 *
 * Provides full lifecycle control: callbacks, status tracking, navigation error handling,
 * `executeAsync`, `reset`, and `formAction` for `<form action={formAction}>` integration.
 *
 * @param safeActionFn The stateful action function created with `.stateAction()`.
 * @param opts Optional configuration: `initResult` for initial state, plus all hook options and callbacks.
 *
 * {@link https://next-safe-action.dev/docs/execute-actions/hooks/usestateaction See docs for more information}
 */
export const useStateAction = <
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
	InitR extends SafeActionResult<ServerError, Schema, ShapedErrors, Data> = HookIdleResult,
>(
	safeActionFn: SingleInputStateActionFn<ServerError, Schema, ShapedErrors, Data>,
	opts?: {
		initResult?: InitR;
	} & HookBaseOptions<ServerError, Schema, ShapedErrors, Data>
): UseStateActionHookReturn<ServerError, Schema, ShapedErrors, Data, InitR> =>
	useStateActionInternal(safeActionFn, opts);

/**
 * Use the stateful action from a Client Component via hook, with optimistic state that is
 * coordinated across overlapping mutations.
 *
 * Where `useOptimisticAction` is last-write-wins (a newer response discards an older one), this
 * hook is built on `useActionState`, so dispatches are **queued**: each one waits for the previous
 * to settle and receives its result as `prevResult`. That is what makes it correct for
 * *accumulate* semantics (reorder an item, then reorder it again) rather than *replace* semantics.
 *
 * Confirmed state is the more recent of the action's successful `data` and the `currentState`
 * option. So an action that returns the full next state owns the confirmed value, while an action
 * that returns nothing leaves `currentState` authoritative, and a revalidated `currentState`
 * always beats a stale client-side fold.
 *
 * "More recent" is judged by arrival for the value you render, and by write order for the base the
 * next queued dispatch sends to the server. A `currentState` that commits while an action is still
 * running was rendered before that action wrote, so it is the older value for the server base even
 * though its identity is newer.
 *
 * @param safeActionFn The stateful action function created with `.stateAction()`.
 * @param utils Required `currentState` and `updateFn`, optional `initResult` and callbacks.
 *
 * {@link https://next-safe-action.dev/docs/execute-actions/hooks/useoptimisticstateaction See docs for more information}
 */
export const useOptimisticStateAction = <
	ServerError,
	Schema extends StandardSchemaV1 | undefined,
	ShapedErrors,
	Data,
	State,
	InitR extends SafeActionResult<ServerError, Schema, ShapedErrors, Data> = HookIdleResult,
>(
	safeActionFn: SingleInputStateActionFn<ServerError, Schema, ShapedErrors, Data>,
	utils: {
		currentState: State;
		updateFn: (state: State, input: InferInputOrDefault<Schema, void>) => State;
		initResult?: InitR;
	} & HookBaseOptions<ServerError, Schema, ShapedErrors, Data> &
		ActionDataFitsState<Data, State>
): UseOptimisticStateActionHookReturn<ServerError, Schema, ShapedErrors, Data, State, InitR> => {
	// ─── Confirmed domain state ───────────────────────────────────────────
	// Deliberately separate from the result envelope. `SafeActionResult` is a discriminated union,
	// so `result.data` is `undefined` on every error branch: folding optimistic updates over it
	// directly would blank the UI on a validation error instead of rolling back to the last good
	// value, and would hand the next queued dispatch a `prevResult` with no domain state at all.
	//
	// Two different "last confirmed" values are tracked, because they answer different questions:
	//
	//   `lastConfirmedRef`  — what the USER SEES. Advances only when `useActionState` commits.
	//                         React withholds that commit until the whole queue drains and drops
	//                         every optimistic payload in the same commit, so a base derived from
	//                         it can never double-apply a payload that is still attached.
	//   `lastServerDataRef` — what the SERVER GETS. Advances the moment a dispatch settles, before
	//                         any commit, because the next queued dispatch runs immediately and
	//                         needs its predecessor's domain state.
	//
	// Advancing the visible base eagerly is exactly the double-apply bug React's withholding avoids.

	// Captured once at mount, mirroring `initResult`: `reset` restores this baseline.
	const initialStateRef = React.useRef(utils.currentState);
	const lastConfirmedRef = React.useRef<State>(utils.currentState);
	const lastServerDataRef = React.useRef<State>(utils.currentState);
	const lastPropRef = React.useRef(utils.currentState);
	// Identifies the committed result a fresh `currentState` has already superseded, so the prop
	// wins once and does not get undone on the next render by the same stale result.
	const supersededResultRef = React.useRef<unknown>(null);
	// Bumped on `reset`, so optimistic payloads scheduled before it are ignored: `useActionState`
	// dispatches cannot be cancelled, and their transitions keep holding those payloads. The value
	// is handed in by `onReset` rather than derived from the rendered one, so it cannot fall behind
	// the internal counter when two resets are batched into a single render.
	const [generation, setGeneration] = React.useState(0);
	// Id of the last dispatch that settled, and the cut the current frame folds above. A payload
	// may only be folded while its dispatch is still pending, which is React's own rule for
	// `useOptimistic`. The hook keeps payloads alive across the whole queue because the visible
	// base normally does not advance until the queue drains, which makes re-folding a settled
	// payload harmless. A `currentState` that commits mid-queue breaks that: it advances the base
	// while every payload is still attached, and the settled ones then apply a second time on top
	// of a base that already accounts for them. Raising the cut to whatever had settled when the
	// prop arrived keeps the payload set consistent with the base it folds over.
	const settledIdRef = React.useRef(0);
	const ackedThroughRef = React.useRef(0);
	// Set by `reset`, cleared once a fresh post-reset dispatch settles. Between those two points
	// `useActionState` still holds the cancelled dispatch's raw result, and the next dispatch clears
	// the `isReset` mask that was hiding it, so without this the UI would briefly fold the new
	// change over state the user already discarded.
	const ignoreCommittedDataRef = React.useRef(false);

	// `useOptimistic` needs the committed result, which only exists after `useStateActionInternal`
	// runs, while `useStateActionInternal` needs the optimistic dispatcher up front. A ref breaks
	// the cycle: the seam is only ever called at dispatch time, long after the first render.
	const addOptimisticRef = React.useRef<
		| ((payload: { generation: number; dispatchId: number; input: InferInputOrDefault<Schema, undefined> }) => void)
		| null
	>(null);

	// ─── Callbacks ────────────────────────────────────────────────────────
	// Fired per dispatch from the strategy seams rather than from the shared effect. While a queue
	// drains, `status` stays `executing` and `result` does not commit, so the effect-driven path
	// cannot observe intermediate results at all. `wrappedAction` runs exactly once per dispatch
	// with both the input and the result in hand, which makes per-dispatch delivery free.
	// Trade-off: these fire before React commits, not after.
	// Seeded at mount and refreshed post-commit (see the layout effect below), never during render.
	const utilsRef = React.useRef(utils);

	const strategies = React.useMemo<StateActionStrategies<ServerError, Schema, ShapedErrors, Data>>(
		() => ({
			suppressCallbacks: true,

			onTransitionStart: (input, dispatchGeneration, dispatchId) => {
				addOptimisticRef.current?.({ generation: dispatchGeneration, dispatchId, input });
				fireCallback((utilsRef.current as HookCallbacks<ServerError, Schema, ShapedErrors, Data>).onExecute, {
					input,
				});
			},

			// Runs when the queued action actually starts. The server always receives the last
			// confirmed domain state, never the raw `prevResult` React threads through: an error
			// envelope carries no `data` at all, so one failed dispatch would otherwise leave the
			// rest of the queue without a base to build on.
			resolvePrevResult: () =>
				({ data: lastServerDataRef.current }) as unknown as SafeActionResult<ServerError, Schema, ShapedErrors, Data>,

			onDispatchSettled: (outcome, input, dispatchId) => {
				const cb = utilsRef.current as HookCallbacks<ServerError, Schema, ShapedErrors, Data>;

				// Every outcome counts, not just a success: a dispatch that failed or navigated is
				// just as finished, and its payload must stop folding once the base moves past it.
				settledIdRef.current = dispatchId;

				if (outcome.navigationError) {
					if (utilsRef.current.throwOnNavigation === true) return;
					const navigationKind = FrameworkErrorHandler.getNavigationKind(outcome.navigationError);
					fireCallback(cb.onNavigation, { input, navigationKind });
					fireCallback(cb.onSettled, { result: {}, input, navigationKind });
					return;
				}

				if (outcome.thrownError) {
					fireCallback(cb.onError, { error: { thrownError: outcome.thrownError }, input });
					fireCallback(cb.onSettled, { result: {}, input });
					return;
				}

				const result = outcome.result ?? {};

				// A dispatch settling is the first observable sign that the queue is draining after a
				// `reset`, so the cancelled dispatch's raw result can no longer be mistaken for this
				// one's.
				ignoreCommittedDataRef.current = false;

				// Feeds `resolvePrevResult` only, never the visible base. The cast is sound because
				// `ActionDataFitsState` constrains the call site: when the action returns data, that
				// data IS the full next `State`.
				//
				// Newest write wins, and arrival order decides it on its own. A `currentState` that
				// committed while this action was running was rendered by the server BEFORE this
				// action wrote, so it is the older value and this assignment correctly overwrites
				// the one the layout effect made. A `currentState` that arrives after this line runs
				// is the newer value, and the layout effect correctly overwrites this. That holds
				// whether the payload acknowledges the previous dispatch or carries an unrelated
				// write: either way the server ends up holding what this action just wrote.
				if (typeof result.data !== "undefined") {
					lastServerDataRef.current = result.data as unknown as State;
				}

				// Same precedence as `getActionStatus`: errors win over success.
				// Casts mirror `useActionCallbacks`: `onSettled`'s public type uses
				// `NormalizeActionResult`, while `result` here is the raw `SafeActionResult`.
				if (typeof result.validationErrors !== "undefined" || typeof result.serverError !== "undefined") {
					fireCallback(cb.onError, { error: result, input });
				} else {
					fireCallback(cb.onSuccess, { data: result.data!, input });
				}
				fireCallback(cb.onSettled, {
					result: result as unknown as NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>,
					input,
				});
			},

			onReset: (resetGeneration) => {
				lastConfirmedRef.current = initialStateRef.current;
				lastServerDataRef.current = initialStateRef.current;
				ignoreCommittedDataRef.current = true;
				// The internal counter is authoritative. Deriving `previous + 1` from rendered state
				// would leave this one step behind whenever two resets are batched into one render,
				// and every later optimistic payload would then be dropped by the reducer below for
				// carrying a generation the frame never reaches.
				setGeneration(resetGeneration);
			},
		}),
		[]
	);

	// Extract hook options, excluding the useOptimisticStateAction-specific properties.
	const { currentState: _, updateFn: __, ...hookOpts } = utils;

	const base = useStateActionInternal(
		safeActionFn,
		hookOpts as { initResult?: InitR } & HookBaseOptions<ServerError, Schema, ShapedErrors, Data>,
		strategies
	);

	// ─── Deriving the confirmed value ─────────────────────────────────────
	// Pure derivation, never a setState during render: an inline `currentState={[]}` (exactly how
	// the pending-changes-list variant is naturally written) would otherwise loop forever. An
	// unstable `currentState` degrades to "confirmed never advances", never to a render loop.
	//
	// Nothing here writes to a ref. React shares ref objects between the current and the
	// work-in-progress fiber, so a render that is started and then thrown away (a Suspense retry,
	// not only StrictMode's double invoke) would otherwise leave state that never committed where
	// the next event handler reads it, and `resolvePrevResult` would send it to the server. Every
	// write is deferred to the layout effect below, which only runs for a render that committed.
	const propChanged = utils.currentState !== lastPropRef.current;
	const committedData = (base.result as { data?: unknown }).data as State | undefined;
	const committedIsFresh = base.result !== supersededResultRef.current && !ignoreCommittedDataRef.current;

	const confirmed = propChanged
		? utils.currentState
		: committedIsFresh && typeof committedData !== "undefined"
			? committedData
			: lastConfirmedRef.current;

	// Derived, never assigned during render, for the same reason as `confirmed`: an abandoned
	// concurrent render must not leave a cut behind that no commit ever agreed to.
	const acked = propChanged ? settledIdRef.current : ackedThroughRef.current;

	React.useLayoutEffect(() => {
		if (propChanged) {
			lastPropRef.current = utils.currentState;
			lastServerDataRef.current = utils.currentState;
			// A revalidated Server Component payload is newer than anything the client folded, so it
			// wins over the result that is currently committed, once.
			supersededResultRef.current = base.result;
		}

		lastConfirmedRef.current = confirmed;
		ackedThroughRef.current = acked;
		// Read at dispatch time by the callback seams, which run from event handlers, so a
		// post-commit assignment is always early enough.
		utilsRef.current = utils;
	});

	// ─── Optimistic state ─────────────────────────────────────────────────

	const [frame, addOptimistic] = React.useOptimistic<
		{ generation: number; acked: number; state: State },
		{ generation: number; dispatchId: number; input: InferInputOrDefault<Schema, undefined> }
	>({ generation, acked, state: confirmed }, (current, payload) =>
		payload.generation === current.generation && payload.dispatchId > current.acked
			? {
					generation: current.generation,
					acked: current.acked,
					state: utils.updateFn(current.state, payload.input as InferInputOrDefault<Schema, void>),
				}
			: current
	);
	React.useLayoutEffect(() => {
		addOptimisticRef.current = addOptimistic;
	});

	// Cast rationale: same as `useOptimisticAction` — runtime consistency is guaranteed by
	// `getActionStatus` + `getActionShorthandStatusObject`, but TypeScript can't verify overlap
	// between the widened object and the distributed intersection-over-union.
	return {
		...base,
		optimisticState: frame.state,
	} as unknown as UseOptimisticStateActionHookReturn<ServerError, Schema, ShapedErrors, Data, State, InitR>;
};

export type * from "./hooks.types";
