import { act, renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useOptimisticStateAction } from "../hooks";
import type { SingleInputStateActionFn } from "../hooks.types";
import type { StandardSchemaV1 } from "../standard-schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Item = string;
type StringSchema = StandardSchemaV1<Item, Item>;
type TestStateActionFn = SingleInputStateActionFn<string, StringSchema, { formErrors: string[] }, Item[]>;

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function createRedirectError(url = "/target"): Error {
	const error = new Error("NEXT_REDIRECT");
	(error as any).digest = `NEXT_REDIRECT;push;${url};307;`;
	return error;
}

async function flushHookTimers() {
	await act(async () => {
		vi.advanceTimersByTime(0);
	});
	await act(async () => {});
}

// `currentState` is identity-compared, so every fixture is hoisted out of the render callback.
const seedA: Item[] = ["a"];
const seedOne: Item[] = ["seed"];
const emptyState: Item[] = [];

/** The optimistic reducer under test: append. Non-idempotent, so a double-apply is visible. */
const appendFn = (state: Item[], input: Item): Item[] => [...state, input];

/** Reduced-state server action: returns the full next state, built from `prevResult.data`. */
function createAppendAction(gates?: Array<{ promise: Promise<void> }>) {
	let call = 0;
	return vi.fn<TestStateActionFn>(async (prevResult, input) => {
		const gate = gates?.[call++];
		if (gate) await gate.promise;
		return { data: [...(prevResult.data ?? []), input] };
	});
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.clearAllMocks();
});

// ─── Basics ──────────────────────────────────────────────────────────────────

describe("useOptimisticStateAction", () => {
	test("seeds optimisticState from currentState", async () => {
		const action = createAppendAction();
		const { result } = renderHook(() => useOptimisticStateAction(action, { currentState: seedA, updateFn: appendFn }));

		expect(result.current.optimisticState).toEqual(["a"]);
		expect(result.current.status).toBe("idle");
	});

	test("applies the optimistic update immediately and converges on the confirmed value", async () => {
		const gate = deferred<void>();
		const action = createAppendAction([gate]);
		const { result } = renderHook(() => useOptimisticStateAction(action, { currentState: seedA, updateFn: appendFn }));

		await act(async () => {
			result.current.execute("b");
		});

		// Server has not answered yet, but the UI already shows the change.
		expect(result.current.optimisticState).toEqual(["a", "b"]);
		expect(result.current.isExecuting).toBe(true);

		await act(async () => {
			gate.resolve();
			await gate.promise;
		});
		await flushHookTimers();

		expect(result.current.optimisticState).toEqual(["a", "b"]);
		expect(result.current.result.data).toEqual(["a", "b"]);
		expect(result.current.status).toBe("hasSucceeded");
	});
});

// ─── Queueing ────────────────────────────────────────────────────────────────

describe("useOptimisticStateAction queueing", () => {
	test("serializes overlapping dispatches and folds both without double-applying", async () => {
		const g1 = deferred<void>();
		const g2 = deferred<void>();
		const action = createAppendAction([g1, g2]);

		const { result } = renderHook(() =>
			useOptimisticStateAction(action, { currentState: emptyState, updateFn: appendFn })
		);

		await act(async () => {
			result.current.execute("a");
		});
		await act(async () => {
			result.current.execute("b");
		});

		expect(result.current.optimisticState).toEqual(["a", "b"]);

		await act(async () => {
			g1.resolve();
			await g1.promise;
		});
		await flushHookTimers();

		// The second dispatch is still in flight: an append reducer would show ["a","a","b"]
		// if its payload were re-applied over an already-advanced confirmed state.
		expect(result.current.optimisticState).toEqual(["a", "b"]);

		await act(async () => {
			g2.resolve();
			await g2.promise;
		});
		await flushHookTimers();

		expect(result.current.optimisticState).toEqual(["a", "b"]);
		expect(result.current.result.data).toEqual(["a", "b"]);
	});

	test("carries confirmed state forward: the second dispatch sees the first's result", async () => {
		const action = createAppendAction();
		const { result } = renderHook(() =>
			useOptimisticStateAction(action, { currentState: seedOne, updateFn: appendFn })
		);

		await act(async () => {
			result.current.execute("a");
		});
		await flushHookTimers();
		await act(async () => {
			result.current.execute("b");
		});
		await flushHookTimers();

		expect(action.mock.calls[0]?.[0]).toEqual({ data: ["seed"] });
		expect(action.mock.calls[1]?.[0]).toEqual({ data: ["seed", "a"] });
		expect(result.current.optimisticState).toEqual(["seed", "a", "b"]);
	});
});

// ─── Error paths ─────────────────────────────────────────────────────────────

describe("useOptimisticStateAction error handling", () => {
	test("rolls back to the last confirmed state on a validation error", async () => {
		const action = vi.fn<TestStateActionFn>(async (prevResult, input) =>
			input === "bad" ? { validationErrors: { formErrors: ["nope"] } } : { data: [...(prevResult.data ?? []), input] }
		);

		const { result } = renderHook(() => useOptimisticStateAction(action, { currentState: seedA, updateFn: appendFn }));

		await act(async () => {
			result.current.execute("good");
		});
		await flushHookTimers();
		expect(result.current.optimisticState).toEqual(["a", "good"]);

		await act(async () => {
			result.current.execute("bad");
		});
		await flushHookTimers();

		// Not ["a"] (the mount value) and not undefined: the last CONFIRMED state.
		expect(result.current.optimisticState).toEqual(["a", "good"]);
		expect(result.current.result.validationErrors).toEqual({ formErrors: ["nope"] });
		expect(result.current.status).toBe("hasErrored");
	});

	test("a failed dispatch does not poison prevResult for the next one", async () => {
		const action = vi.fn<TestStateActionFn>(async (prevResult, input) =>
			input === "bad" ? { validationErrors: { formErrors: ["nope"] } } : { data: [...(prevResult.data ?? []), input] }
		);

		const { result } = renderHook(() => useOptimisticStateAction(action, { currentState: seedA, updateFn: appendFn }));

		await act(async () => {
			result.current.execute("bad");
		});
		await flushHookTimers();
		await act(async () => {
			result.current.execute("good");
		});
		await flushHookTimers();

		// Without normalization this would be { validationErrors: ... } and the state would be lost.
		expect(action.mock.calls[1]?.[0]).toEqual({ data: ["a"] });
		expect(result.current.optimisticState).toEqual(["a", "good"]);
	});

	test("rolls back on a server error", async () => {
		const action = vi.fn<TestStateActionFn>(async () => ({ serverError: "boom" }));
		const { result } = renderHook(() => useOptimisticStateAction(action, { currentState: seedA, updateFn: appendFn }));

		await act(async () => {
			result.current.execute("b");
		});
		await flushHookTimers();

		expect(result.current.optimisticState).toEqual(["a"]);
		expect(result.current.result.serverError).toBe("boom");
	});

	test("a raw thrown error holds the optimistic value, matching useStateAction", async () => {
		const action = vi.fn<TestStateActionFn>(async () => {
			throw new Error("kaboom");
		});
		const { result } = renderHook(() => useOptimisticStateAction(action, { currentState: seedA, updateFn: appendFn }));

		// `wrappedAction` re-throws non-navigation errors so they reach a React error boundary.
		try {
			await act(async () => {
				result.current.execute("b");
			});
		} catch {
			/* expected */
		}
		await flushHookTimers();

		// Pre-existing `useStateAction` behaviour, not specific to this hook: React never commits a
		// result for a rejected action, so its pending flag never clears and `status` stays
		// `executing`. React holds an optimistic value for as long as its Action is pending, so the
		// update is still shown. Errors surfaced through the result envelope (`serverError` /
		// `validationErrors` / `returnServerError`) settle normally and do roll back.
		expect(result.current.status).toBe("executing");
		expect(result.current.optimisticState).toEqual(["a", "b"]);
	});

	test("reports navigation and rolls back", async () => {
		const action = vi.fn<TestStateActionFn>(async () => {
			throw createRedirectError();
		});
		const { result } = renderHook(() => useOptimisticStateAction(action, { currentState: seedA, updateFn: appendFn }));

		await act(async () => {
			result.current.execute("b");
		});
		await flushHookTimers();

		expect(result.current.optimisticState).toEqual(["a"]);
		expect(result.current.hasNavigated).toBe(true);
	});
});

// ─── Confirmed-state rule ────────────────────────────────────────────────────

describe("useOptimisticStateAction confirmed state", () => {
	test("a changed currentState prop wins over the client-side fold", async () => {
		const action = createAppendAction();
		const { result, rerender } = renderHook(
			({ currentState }: { currentState: Item[] }) =>
				useOptimisticStateAction(action, { currentState, updateFn: appendFn }),
			{ initialProps: { currentState: seedA } }
		);

		await act(async () => {
			result.current.execute("b");
		});
		await flushHookTimers();
		expect(result.current.optimisticState).toEqual(["a", "b"]);

		// Simulates a revalidated Server Component payload.
		await act(async () => {
			rerender({ currentState: ["server", "truth"] });
		});

		expect(result.current.optimisticState).toEqual(["server", "truth"]);
	});

	test("an unstable currentState degrades gracefully instead of looping", async () => {
		const gate = deferred<void>();
		const action = createAppendAction([gate]);
		let renders = 0;

		// Inline literal: a new identity on every render. This is how the pending-changes-list
		// variant is naturally written, so it must not cost a render loop.
		const { result } = renderHook(() => {
			renders++;
			return useOptimisticStateAction(action, { currentState: ["a"], updateFn: appendFn });
		});

		await act(async () => {
			result.current.execute("b");
		});

		expect(result.current.optimisticState).toEqual(["a", "b"]);
		expect(result.current.isExecuting).toBe(true);
		expect(renders).toBeLessThan(10);

		await act(async () => {
			gate.resolve();
			await gate.promise;
		});
		await flushHookTimers();

		// Confirmed never advances past the ever-fresh prop, so the fold drains. No loop.
		expect(result.current.optimisticState).toEqual(["a"]);
	});

	test("a stable currentState prop leaves the action's data authoritative", async () => {
		const action = createAppendAction();
		const { result, rerender } = renderHook(() =>
			useOptimisticStateAction(action, { currentState: seedA, updateFn: appendFn })
		);

		await act(async () => {
			result.current.execute("b");
		});
		await flushHookTimers();
		await act(async () => {
			rerender();
		});

		expect(result.current.optimisticState).toEqual(["a", "b"]);
	});
});

// ─── Reset ───────────────────────────────────────────────────────────────────

describe("useOptimisticStateAction reset", () => {
	test("restores the initial state and ignores pre-reset optimistic payloads", async () => {
		const gate = deferred<void>();
		const action = createAppendAction([gate]);
		const { result } = renderHook(() => useOptimisticStateAction(action, { currentState: seedA, updateFn: appendFn }));

		await act(async () => {
			result.current.execute("b");
		});
		expect(result.current.optimisticState).toEqual(["a", "b"]);

		await act(async () => {
			result.current.reset();
		});
		await flushHookTimers();

		// The in-flight transition still holds payload "b"; the generation guard drops it.
		expect(result.current.optimisticState).toEqual(["a"]);
		expect(result.current.status).toBe("idle");

		await act(async () => {
			gate.resolve();
			await gate.promise;
		});
		await flushHookTimers();

		expect(result.current.optimisticState).toEqual(["a"]);
	});
});

// ─── Callbacks ───────────────────────────────────────────────────────────────

describe("useOptimisticStateAction callbacks", () => {
	test("fires once per dispatch, in dispatch order, while the queue drains", async () => {
		const action = createAppendAction();
		const onExecute = vi.fn();
		const onSuccess = vi.fn();
		const onSettled = vi.fn();

		const { result } = renderHook(() =>
			useOptimisticStateAction(action, {
				currentState: emptyState,
				updateFn: appendFn,
				onExecute,
				onSuccess,
				onSettled,
			})
		);

		await act(async () => {
			result.current.execute("a");
		});
		await act(async () => {
			result.current.execute("b");
		});
		await flushHookTimers();

		expect(onExecute).toHaveBeenCalledTimes(2);
		expect(onExecute.mock.calls.map((c) => c[0].input)).toEqual(["a", "b"]);
		expect(onSuccess).toHaveBeenCalledTimes(2);
		expect(onSuccess.mock.calls.map((c) => c[0].input)).toEqual(["a", "b"]);
		expect(onSuccess.mock.calls[1]?.[0].data).toEqual(["a", "b"]);
		expect(onSettled).toHaveBeenCalledTimes(2);
	});

	test("fires onError per failed dispatch", async () => {
		const action = vi.fn<TestStateActionFn>(async () => ({ serverError: "boom" }));
		const onError = vi.fn();
		const onSuccess = vi.fn();

		const { result } = renderHook(() =>
			useOptimisticStateAction(action, {
				currentState: emptyState,
				updateFn: appendFn,
				onError,
				onSuccess,
			})
		);

		await act(async () => {
			result.current.execute("a");
		});
		await flushHookTimers();

		expect(onError).toHaveBeenCalledTimes(1);
		expect(onError.mock.calls[0]?.[0].error.serverError).toBe("boom");
		expect(onSuccess).not.toHaveBeenCalled();
	});
});

// ─── formAction ──────────────────────────────────────────────────────────────

describe("useOptimisticStateAction formAction", () => {
	test("applies the optimistic update on the form dispatch path", async () => {
		const gate = deferred<void>();
		const action = createAppendAction([gate]);
		const { result } = renderHook(() => useOptimisticStateAction(action, { currentState: seedA, updateFn: appendFn }));

		// React invokes form actions inside its own transition; without an ambient one the
		// optimistic value has no Action to hold it. This mirrors a real `<form action={...}>`.
		const scope = deferred<void>();
		await act(async () => {
			React.startTransition(async () => {
				result.current.formAction("b");
				await scope.promise;
			});
		});

		expect(result.current.optimisticState).toEqual(["a", "b"]);

		await act(async () => {
			gate.resolve();
			scope.resolve();
			await gate.promise;
		});
		await flushHookTimers();

		expect(result.current.result.data).toEqual(["a", "b"]);
	});
});

// ─── Pending-changes-list variant ────────────────────────────────────────────

describe("useOptimisticStateAction pending-changes-list variant", () => {
	test("a constant base with an append reducer drains when the queue settles", async () => {
		const gate = deferred<void>();
		// Returns no data, so `currentState` stays authoritative.
		const action = vi.fn<SingleInputStateActionFn<string, StringSchema, undefined, void>>(async () => {
			await gate.promise;
			return { data: undefined };
		});

		const { result } = renderHook(() =>
			useOptimisticStateAction(action, { currentState: emptyState, updateFn: appendFn })
		);

		await act(async () => {
			result.current.execute("c1");
		});
		expect(result.current.optimisticState).toEqual(["c1"]);

		await act(async () => {
			gate.resolve();
			await gate.promise;
		});
		await flushHookTimers();

		// The pending list drains: confirmed never advanced past the constant base.
		expect(result.current.optimisticState).toEqual([]);
	});
});
