import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAction, useOptimisticAction } from "../hooks";
import type { SingleInputActionFn } from "../hooks.types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type TestActionFn = SingleInputActionFn<string, undefined, undefined, { message: string }>;

function createRedirectError(url = "/target"): Error {
	const error = new Error("NEXT_REDIRECT");
	(error as any).digest = `NEXT_REDIRECT;push;${url};307;`;
	return error;
}

function createNotFoundError(): Error {
	const error = new Error("NEXT_HTTP_ERROR_FALLBACK");
	(error as any).digest = "NEXT_HTTP_ERROR_FALLBACK;404";
	return error;
}

/**
 * Flush the setTimeout(..., 0) used by hooks to defer state updates,
 * then flush microtasks/transitions.
 */
async function flushHookTimers() {
	await act(async () => {
		vi.advanceTimersByTime(0);
	});
	await act(async () => {});
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

// ─── useAction ───────────────────────────────────────────────────────────────

describe("useAction", () => {
	test("starts in idle status with empty result", () => {
		const action = vi.fn<TestActionFn>();
		const { result } = renderHook(() => useAction(action));

		expect(result.current.status).toBe("idle");
		expect(result.current.isIdle).toBe(true);
		expect(result.current.result).toEqual({});
		expect(result.current.input).toBeUndefined();
	});

	test("transitions to hasSucceeded on successful action", async () => {
		const action = vi.fn<TestActionFn>().mockResolvedValue({
			data: { message: "ok" },
		});

		const { result } = renderHook(() => useAction(action));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.status).toBe("hasSucceeded");
		expect(result.current.hasSucceeded).toBe(true);
		expect(result.current.isIdle).toBe(false);
	});

	test("stores input after execution", async () => {
		const action = vi.fn<SingleInputActionFn<string, undefined, undefined, string>>().mockResolvedValue({
			data: "done",
		});

		const { result } = renderHook(() => useAction(action));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(action).toHaveBeenCalledWith(undefined);
	});

	test("sets result.data on successful action", async () => {
		const action = vi.fn<TestActionFn>().mockResolvedValue({
			data: { message: "hello" },
		});

		const { result } = renderHook(() => useAction(action));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.result.data).toEqual({ message: "hello" });
	});

	test("sets hasErrored when action returns validationErrors", async () => {
		const action = vi.fn<TestActionFn>().mockResolvedValue({
			validationErrors: { _errors: ["Invalid input"] } as any,
		});

		const { result } = renderHook(() => useAction(action));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.status).toBe("hasErrored");
		expect(result.current.hasErrored).toBe(true);
	});

	test("sets hasErrored when action returns serverError", async () => {
		const action = vi.fn<TestActionFn>().mockResolvedValue({
			serverError: "Internal error",
		});

		const { result } = renderHook(() => useAction(action));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.status).toBe("hasErrored");
		expect(result.current.hasErrored).toBe(true);
		expect(result.current.result.serverError).toBe("Internal error");
	});

	test("sets hasErrored when action throws non-navigation error", async () => {
		const action = vi.fn<TestActionFn>().mockRejectedValue(new Error("Network failure"));

		const { result } = renderHook(() => useAction(action));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.status).toBe("hasErrored");
		expect(result.current.hasErrored).toBe(true);
		expect(result.current.result).toEqual({});
	});

	// ─── executeAsync ────────────────────────────────────────────────────────

	test("executeAsync resolves with action result on success", async () => {
		const action = vi.fn<TestActionFn>().mockResolvedValue({
			data: { message: "async result" },
		});

		const { result } = renderHook(() => useAction(action));

		let asyncResult: any;
		act(() => {
			void result.current.executeAsync(undefined).then((r) => {
				asyncResult = r;
			});
		});

		await flushHookTimers();

		expect(asyncResult).toEqual({ data: { message: "async result" } });
	});

	test("executeAsync rejects when action throws non-navigation error", async () => {
		const error = new Error("Boom");
		const action = vi.fn<TestActionFn>().mockRejectedValue(error);

		const { result } = renderHook(() => useAction(action));

		let rejectedError: any;
		act(() => {
			void result.current.executeAsync(undefined).catch((e) => {
				rejectedError = e;
			});
		});

		await flushHookTimers();

		expect(rejectedError).toBe(error);
	});

	// ─── reset ───────────────────────────────────────────────────────────────

	test("resets all state back to idle", async () => {
		const action = vi.fn<TestActionFn>().mockResolvedValue({
			data: { message: "done" },
		});

		const { result } = renderHook(() => useAction(action));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.status).toBe("hasSucceeded");

		act(() => {
			result.current.reset();
		});

		expect(result.current.status).toBe("idle");
		expect(result.current.isIdle).toBe(true);
		expect(result.current.result).toEqual({});
		expect(result.current.input).toBeUndefined();
	});

	// ─── Navigation errors ───────────────────────────────────────────────────

	test("sets hasNavigated on redirect error", async () => {
		const action = vi.fn<TestActionFn>().mockRejectedValue(createRedirectError("/dashboard"));

		const { result } = renderHook(() => useAction(action));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.status).toBe("hasNavigated");
		expect(result.current.hasNavigated).toBe(true);
	});

	test("sets hasNavigated on notFound error", async () => {
		const action = vi.fn<TestActionFn>().mockRejectedValue(createNotFoundError());

		const { result } = renderHook(() => useAction(action));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.status).toBe("hasNavigated");
		expect(result.current.hasNavigated).toBe(true);
	});

	// ─── Shorthand status flags ──────────────────────────────────────────────

	test("isPending true during execution", async () => {
		let resolveAction!: (value: any) => void;
		const action = vi.fn<TestActionFn>().mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveAction = resolve;
				})
		);

		const { result } = renderHook(() => useAction(action));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.isPending).toBe(true);

		await act(async () => {
			resolveAction({ data: { message: "done" } });
		});

		await flushHookTimers();

		expect(result.current.isPending).toBe(false);
	});
});

// ─── useOptimisticAction ─────────────────────────────────────────────────────

const updateFn = (state: { count: number }, _input: void) => ({ count: state.count + 1 });

describe("useOptimisticAction", () => {
	const currentState = { count: 0 };

	test("starts with currentState as optimisticState", () => {
		const action = vi.fn<TestActionFn>();

		const { result } = renderHook(() =>
			useOptimisticAction(action, {
				currentState,
				updateFn,
			})
		);

		expect(result.current.optimisticState).toEqual({ count: 0 });
	});

	test("returns optimisticState in return object", () => {
		const action = vi.fn<TestActionFn>();

		const { result } = renderHook(() =>
			useOptimisticAction(action, {
				currentState,
				updateFn,
			})
		);

		expect(result.current).toHaveProperty("optimisticState");
	});

	test("execute triggers action and sets result on success", async () => {
		const action = vi.fn<TestActionFn>().mockResolvedValue({
			data: { message: "optimistic done" },
		});

		const { result } = renderHook(() =>
			useOptimisticAction(action, {
				currentState,
				updateFn,
			})
		);

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.status).toBe("hasSucceeded");
		expect(result.current.result.data).toEqual({ message: "optimistic done" });
	});

	test("executeAsync resolves with action result", async () => {
		const action = vi.fn<TestActionFn>().mockResolvedValue({
			data: { message: "async optimistic" },
		});

		const { result } = renderHook(() =>
			useOptimisticAction(action, {
				currentState,
				updateFn,
			})
		);

		let asyncResult: any;
		act(() => {
			void result.current.executeAsync(undefined).then((r) => {
				asyncResult = r;
			});
		});

		await flushHookTimers();

		expect(asyncResult).toEqual({ data: { message: "async optimistic" } });
	});

	test("reset clears state back to idle", async () => {
		const action = vi.fn<TestActionFn>().mockResolvedValue({
			data: { message: "done" },
		});

		const { result } = renderHook(() =>
			useOptimisticAction(action, {
				currentState,
				updateFn,
			})
		);

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.status).toBe("hasSucceeded");

		act(() => {
			result.current.reset();
		});

		expect(result.current.status).toBe("idle");
		expect(result.current.result).toEqual({});
	});

	test("handles thrown errors like useAction", async () => {
		const action = vi.fn<TestActionFn>().mockRejectedValue(new Error("Optimistic failure"));

		const { result } = renderHook(() =>
			useOptimisticAction(action, {
				currentState,
				updateFn,
			})
		);

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.status).toBe("hasErrored");
		expect(result.current.hasErrored).toBe(true);
	});
});
