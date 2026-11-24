"use client";

import * as React from "react";
import { getActionShorthandStatusObject, getActionStatus, useActionCallbacks } from "./hooks-utils";
import type {
	HookActionStatus,
	HookBaseOptions,
	HookCallbacks,
	SingleInputActionFn,
	HookShorthandStatus,
} from "./hooks.types";
import type { NormalizeActionResult, SafeActionResult } from "./index.types";
import { FrameworkErrorHandler } from "./next/errors";
import type { InferInputOrDefault, StandardSchemaV1 } from "./standard-schema";

/**
 * Shared base hook for `useAction` and `useOptimisticAction`.
 * Extracts common state management, execution logic, and callback wiring.
 *
 * @param onTransitionStart Optional callback invoked inside `startTransition` before the action runs.
 *   Used by `useOptimisticAction` to call `setOptimisticValue`. It is read directly (it is a dep of
 *   `execute`/`executeAsync`), never mirrored into a ref during render: the only caller passes the
 *   `useOptimistic` dispatcher, whose identity is stable, so the callbacks stay stable too.
 */
export function useActionBase<ServerError, Schema extends StandardSchemaV1 | undefined, ShapedErrors, Data>(
	safeActionFn: SingleInputActionFn<ServerError, Schema, ShapedErrors, Data>,
	opts:
		| ({
				initResult?: SafeActionResult<ServerError, Schema, ShapedErrors, Data>;
		  } & HookBaseOptions<ServerError, Schema, ShapedErrors, Data>)
		| undefined,
	onTransitionStart?: (input: InferInputOrDefault<Schema, undefined>) => void
): {
	isTransitioning: boolean;
	// Exposed as `NormalizeActionResult<...>` so that void-returning actions
	// surface `data: undefined` rather than `data: void | undefined`. The
	// internal `useState` still holds the raw `SafeActionResult` union, the
	// type-only narrowing happens once at this boundary via a cast.
	result: NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>;
	clientInput: InferInputOrDefault<Schema, void> | undefined;
	status: HookActionStatus;
	execute: (input: InferInputOrDefault<Schema, void>) => void;
	executeAsync: (
		input: InferInputOrDefault<Schema, void>
	) => Promise<NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>>;
	reset: () => void;
	shorthandStatus: HookShorthandStatus;
} {
	// `initResult` is captured once at mount, mirroring React's `useActionState` initialState:
	// later changes to the option are ignored, and `reset` restores this baseline.
	const initResultRef = React.useRef<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>(opts?.initResult ?? {});

	const [isTransitioning, startTransition] = React.useTransition();
	const [result, setResult] = React.useState<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>(
		// oxlint-disable-next-line react/refs -- mount-captured `initResult`, never written after mount
		initResultRef.current
	);
	const [clientInput, setClientInput] = React.useState<InferInputOrDefault<Schema, void>>();
	const [isExecuting, setIsExecuting] = React.useState(false);
	const [navigationError, setNavigationError] = React.useState<Error | null>(null);
	const [thrownError, setThrownError] = React.useState<Error | null>(null);
	const [isIdle, setIsIdle] = React.useState(true);
	// Identifies the execution the committed state belongs to; `0` means none yet. Set inside
	// the dispatch-time batch so it can never advance ahead of the state it describes.
	const [executionId, setExecutionId] = React.useState(0);

	// Request ordering: only the latest request's response updates UI state.
	// This prevents stale responses from overwriting fresh state on rapid calls.
	const requestIdRef = React.useRef(0);

	// Applies dispatch-time state twice, on purpose.
	//
	// The synchronous call is what normally commits. When the dispatch happens inside an
	// ambient React transition it does not: `<form action={execute}>` has React set its
	// internal current transition before calling the action, so these updates inherit the
	// transition lane, and Next's router suspends on that same lane while it awaits the RSC
	// response. A render whose lanes are only transition lanes and that suspends is never
	// committed, so `status` reads `idle` for the whole request.
	//
	// A microtask runs after React restores the current transition in `startTransition`'s
	// `finally`, so the repeat lands on the default lane and commits right away, exactly like
	// the `setResult` call in the `.then` handler below already does. Outside a transition the
	// repeat is an eager bailout: same values, no extra render.
	const beginExecution = React.useCallback((requestId: number, input: InferInputOrDefault<Schema, void>) => {
		const apply = () => {
			setIsIdle(false);
			setNavigationError(null);
			setThrownError(null);
			setClientInput(input);
			setIsExecuting(true);
			setExecutionId(requestId);
		};

		apply();

		queueMicrotask(() => {
			// A `reset` or a newer execution landed in between: its state must win.
			if (requestId !== requestIdRef.current) return;
			apply();
		});
	}, []);

	const status = getActionStatus<ServerError, Schema, ShapedErrors, Data>({
		isExecuting,
		result,
		isIdle,
		hasNavigated: navigationError !== null,
		hasThrownError: thrownError !== null,
	});

	// The transition callbacks below deliberately do not return the promise chain. React only
	// takes ownership of a promise the callback returns, and it would then keep `isTransitioning`
	// on until the request settles, pin the optimistic value to that lifetime, and throw a rejected
	// request during render into the nearest error boundary. Errors reach the caller through hook
	// state, the callbacks, and the `executeAsync` rejection instead, so the chain must also never
	// end in a rejection nobody owns: a re-throw inside `.catch` did exactly that (#482).
	const execute = React.useCallback(
		(input: InferInputOrDefault<Schema, void>) => {
			const thisRequestId = ++requestIdRef.current;

			beginExecution(thisRequestId, input);

			startTransition(() => {
				onTransitionStart?.(input as InferInputOrDefault<Schema, undefined>);

				safeActionFn(input as InferInputOrDefault<Schema, undefined>)
					.then((res) => {
						if (thisRequestId !== requestIdRef.current) return;
						setResult(res ?? {});
					})
					.catch((e) => {
						// The error is delivered through hook state only: `thrownError` feeds `status` and
						// `onError({ error: { thrownError } })`, a navigation error feeds `hasNavigated` or the
						// render-phase throw behind `throwOnNavigation`. Nothing is re-thrown here (#482).
						if (thisRequestId !== requestIdRef.current) return;

						setResult({});

						if (FrameworkErrorHandler.isNavigationError(e)) {
							setNavigationError(e);
						} else {
							setThrownError(e as Error);
						}
					})
					.finally(() => {
						if (thisRequestId !== requestIdRef.current) return;
						setIsExecuting(false);
					});
			});
		},
		[beginExecution, onTransitionStart, safeActionFn]
	);

	const executeAsync = React.useCallback(
		(input: InferInputOrDefault<Schema, void>) => {
			return new Promise<Awaited<ReturnType<typeof safeActionFn>>>((resolve, reject) => {
				const thisRequestId = ++requestIdRef.current;

				beginExecution(thisRequestId, input);

				startTransition(() => {
					onTransitionStart?.(input as InferInputOrDefault<Schema, undefined>);

					safeActionFn(input as InferInputOrDefault<Schema, undefined>)
						.then((res) => {
							if (thisRequestId === requestIdRef.current) {
								setResult(res ?? {});
							}
							// Always resolve so the caller's await settles.
							resolve(res);
						})
						.catch((e) => {
							if (thisRequestId === requestIdRef.current) {
								setResult({});

								if (FrameworkErrorHandler.isNavigationError(e)) {
									setNavigationError(e);
								} else {
									setThrownError(e as Error);
								}
							}

							// Always reject so the caller's await settles. This rejection and the hook state
							// are the only two channels for the error: nothing is re-thrown here (#482).
							reject(e);
						})
						.finally(() => {
							if (thisRequestId !== requestIdRef.current) return;
							setIsExecuting(false);
						});
				});
			});
		},
		[beginExecution, onTransitionStart, safeActionFn]
	);

	const reset = React.useCallback(() => {
		// Invalidate in-flight requests: their responses must not repopulate state after a reset.
		// Since stale requests skip their own `setIsExecuting(false)` in `finally`, clear it here.
		const thisRequestId = ++requestIdRef.current;

		const apply = () => {
			setIsIdle(true);
			setNavigationError(null);
			setThrownError(null);
			setClientInput(undefined);
			// Restore the mount-captured initial result (or empty when not provided), matching
			// `useStateAction`'s contract: `reset` returns to the initial state.
			setResult(initResultRef.current);
			setIsExecuting(false);
			// `executionId` is deliberately left alone. The `onExecute` arm only fires on an
			// `executing` status, which a reset never produces, and `execute` always allocates a
			// higher id from the same counter. Advancing it here would only defeat React's bailout
			// and make `reset` on an already-idle hook re-render for nothing. Leaving it also keeps
			// a stale, still-frozen dispatch from re-announcing itself if its lane commits later.
		};

		// Same two-step dispatch as `beginExecution`: a `reset` called from inside an ambient
		// transition would otherwise be withheld for as long as an execution is.
		apply();

		queueMicrotask(() => {
			// A newer execution landed in between: its state must win.
			if (thisRequestId !== requestIdRef.current) return;
			apply();
		});
	}, []);

	useActionCallbacks({
		result: result ?? {},
		input: clientInput as InferInputOrDefault<Schema, undefined>,
		status,
		executionId,
		throwOnNavigation: opts?.throwOnNavigation === true,
		navigationError,
		thrownError,
		// Cast: HookBaseOptions is a discriminated union that always includes callback properties at runtime.
		// When throwOnNavigation is true, onNavigation/onSettled are omitted from the type but absent at runtime too.
		cb: opts as HookCallbacks<ServerError, Schema, ShapedErrors, Data> | undefined,
	});

	// When throwOnNavigation is explicitly enabled, throw navigation errors during React's render
	// phase so they reach the nearest error boundary. In Next.js, this is HTTPAccessFallbackBoundary,
	// which shows 404/403/401 pages.
	if (opts?.throwOnNavigation === true && navigationError !== null) {
		throw navigationError;
	}

	return {
		isTransitioning,
		// `result` and `executeAsync` are structurally compatible with
		// `NormalizeActionResult<SafeActionResult<...>>` for every concrete `Data`
		// the runtime ever produces, `NormalizeActionResult` only drops the
		// `{ data: void }` branch, which the action builder never emits (see
		// `buildResultAndRunCallbacks` in `action-builder.ts`). TypeScript can't
		// verify this while `Data` is still a free generic, so the cast is
		// isolated here and not repeated across every consumer hook.
		result: result as unknown as NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>,
		clientInput,
		status,
		execute,
		executeAsync: executeAsync as unknown as (
			input: InferInputOrDefault<Schema, void>
		) => Promise<NormalizeActionResult<SafeActionResult<ServerError, Schema, ShapedErrors, Data>>>,
		reset,
		shorthandStatus: getActionShorthandStatusObject({ status, isTransitioning }),
	};
}
