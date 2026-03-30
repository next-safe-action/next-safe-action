import { renderHook, act } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useStateAction } from "../hooks";
import type { SingleInputStateActionFn } from "../hooks.types";
import type { SafeActionResult } from "../index.types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type TestResult = SafeActionResult<string, undefined, undefined, { message: string }>;
type TestStateActionFn = SingleInputStateActionFn<string, undefined, undefined, { message: string }>;

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

function createForbiddenError(): Error {
	const error = new Error("NEXT_HTTP_ERROR_FALLBACK");
	(error as any).digest = "NEXT_HTTP_ERROR_FALLBACK;403";
	return error;
}

function createUnauthorizedError(): Error {
	const error = new Error("NEXT_HTTP_ERROR_FALLBACK");
	(error as any).digest = "NEXT_HTTP_ERROR_FALLBACK;401";
	return error;
}

async function flushHookTimers() {
	await act(async () => {
		vi.advanceTimersByTime(0);
	});
	await act(async () => {});
}

/**
 * Create a mock stateful action that receives (prevResult, input) and returns a result.
 */
function createMockStateAction(impl?: (prevResult: TestResult, input: undefined) => Promise<TestResult>) {
	return vi.fn<TestStateActionFn>(impl ?? (async () => ({ data: { message: "ok" } })));
}

// ─── Error boundary wrapper ─────────────────────────────────────────────────

let capturedBoundaryError: Error | null = null;

class TestErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
	state = { hasError: false };

	static getDerivedStateFromError(error: Error) {
		capturedBoundaryError = error;
		return { hasError: true };
	}

	render() {
		if (this.state.hasError) return null;
		return this.props.children;
	}
}

function errorBoundaryWrapper({ children }: { children: React.ReactNode }) {
	return <TestErrorBoundary>{children}</TestErrorBoundary>;
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
	vi.useFakeTimers();
	capturedBoundaryError = null;
});

afterEach(() => {
	vi.useRealTimers();
});

// ─── Basic lifecycle ────────────────────────────────────────────────────────

describe("useStateAction basic lifecycle", () => {
	test("starts in idle status with empty result", () => {
		const action = createMockStateAction();
		const { result } = renderHook(() => useStateAction(action));

		expect(result.current.status).toBe("idle");
		expect(result.current.isIdle).toBe(true);
		expect(result.current.result).toEqual({});
		expect(result.current.input).toBeUndefined();
	});

	test("transitions to hasSucceeded on successful action", async () => {
		const action = createMockStateAction();
		const { result } = renderHook(() => useStateAction(action));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.status).toBe("hasSucceeded");
		expect(result.current.hasSucceeded).toBe(true);
		expect(result.current.isIdle).toBe(false);
	});

	test("sets result.data on successful action", async () => {
		const action = createMockStateAction(async () => ({
			data: { message: "hello from state action" },
		}));

		const { result } = renderHook(() => useStateAction(action));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.result.data).toEqual({ message: "hello from state action" });
	});

	test("sets hasErrored when action returns validationErrors", async () => {
		const action = createMockStateAction(async () => ({
			validationErrors: { _errors: ["Invalid input"] } as any,
		}));

		const { result } = renderHook(() => useStateAction(action));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.status).toBe("hasErrored");
		expect(result.current.hasErrored).toBe(true);
	});

	test("sets hasErrored when action returns serverError", async () => {
		const action = createMockStateAction(async () => ({
			serverError: "Internal error",
		}));

		const { result } = renderHook(() => useStateAction(action));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.status).toBe("hasErrored");
		expect(result.current.hasErrored).toBe(true);
		expect(result.current.result.serverError).toBe("Internal error");
	});

	test("isPending true during execution", async () => {
		let resolveAction!: (value: TestResult) => void;
		const action = createMockStateAction(
			() =>
				new Promise((resolve) => {
					resolveAction = resolve;
				})
		);

		const { result } = renderHook(() => useStateAction(action));

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

	test("exposes formAction as a function", () => {
		const action = createMockStateAction();
		const { result } = renderHook(() => useStateAction(action));

		expect(typeof result.current.formAction).toBe("function");
	});

	test("uses initResult as initial result", () => {
		const action = createMockStateAction();
		const { result } = renderHook(() =>
			useStateAction(action, {
				initResult: { data: { message: "initial" } },
			})
		);

		expect(result.current.result.data).toEqual({ message: "initial" });
	});
});

// ─── prevResult ─────────────────────────────────────────────────────────────

describe("useStateAction prevResult", () => {
	test("action receives previous result on sequential calls", async () => {
		const calls: TestResult[] = [];
		const action = createMockStateAction(async (prevResult) => {
			calls.push(prevResult);
			return { data: { message: `call-${calls.length}` } };
		});

		const { result } = renderHook(() => useStateAction(action));

		// First call: prevResult should be {} (initial)
		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(calls[0]).toEqual({});
		expect(result.current.result.data).toEqual({ message: "call-1" });

		// Second call: prevResult should be the first call's result
		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(calls[1]).toEqual({ data: { message: "call-1" } });
		expect(result.current.result.data).toEqual({ message: "call-2" });
	});

	test("action receives initResult as first prevResult when provided", async () => {
		let receivedPrevResult: TestResult | undefined;
		const action = createMockStateAction(async (prevResult) => {
			receivedPrevResult = prevResult;
			return { data: { message: "done" } };
		});

		const { result } = renderHook(() =>
			useStateAction(action, {
				initResult: { data: { message: "seed" } },
			})
		);

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(receivedPrevResult).toEqual({ data: { message: "seed" } });
	});
});

// ─── executeAsync ───────────────────────────────────────────────────────────

describe("useStateAction executeAsync", () => {
	test("resolves with action result on success", async () => {
		const action = createMockStateAction(async () => ({
			data: { message: "async result" },
		}));

		const { result } = renderHook(() => useStateAction(action));

		let asyncResult: TestResult | undefined;
		act(() => {
			void result.current.executeAsync(undefined).then((r) => {
				asyncResult = r;
			});
		});

		await flushHookTimers();

		expect(asyncResult).toEqual({ data: { message: "async result" } });
	});

	test("rejects when action throws navigation error", async () => {
		const redirectError = createRedirectError("/dashboard");
		const action = createMockStateAction(async () => {
			throw redirectError;
		});

		const { result } = renderHook(() => useStateAction(action));

		let rejectedError: unknown;
		act(() => {
			void result.current.executeAsync(undefined).catch((e) => {
				rejectedError = e;
			});
		});

		await flushHookTimers();

		expect(rejectedError).toBe(redirectError);
	});
});

// ─── reset ──────────────────────────────────────────────────────────────────

describe("useStateAction reset", () => {
	test("resets all state back to idle", async () => {
		const action = createMockStateAction();
		const { result } = renderHook(() => useStateAction(action));

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

	test("reset overrides prevResult for next execution", async () => {
		let receivedPrevResult: TestResult | undefined;
		const action = createMockStateAction(async (prevResult) => {
			receivedPrevResult = prevResult;
			return { data: { message: "after-reset" } };
		});

		const initResult: TestResult = { data: { message: "seed" } };
		const { result } = renderHook(() => useStateAction(action, { initResult }));

		// First call
		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(receivedPrevResult).toEqual({ data: { message: "seed" } });

		// Reset
		act(() => {
			result.current.reset();
		});

		// Second call after reset: should receive initResult, not last result
		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(receivedPrevResult).toEqual({ data: { message: "seed" } });
	});
});

// ─── Navigation errors ──────────────────────────────────────────────────────

describe("useStateAction navigation errors", () => {
	test("sets hasNavigated on redirect error", async () => {
		const action = createMockStateAction(async () => {
			throw createRedirectError("/dashboard");
		});

		const { result } = renderHook(() => useStateAction(action));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(result.current.status).toBe("hasNavigated");
		expect(result.current.hasNavigated).toBe(true);
	});

	test("sets hasNavigated on notFound error", async () => {
		const action = createMockStateAction(async () => {
			throw createNotFoundError();
		});

		const { result } = renderHook(() => useStateAction(action));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(result.current.status).toBe("hasNavigated");
		expect(result.current.hasNavigated).toBe(true);
	});

	test("sets hasNavigated on forbidden error", async () => {
		const action = createMockStateAction(async () => {
			throw createForbiddenError();
		});

		const { result } = renderHook(() => useStateAction(action));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(result.current.status).toBe("hasNavigated");
		expect(result.current.hasNavigated).toBe(true);
	});

	test("sets hasNavigated on unauthorized error", async () => {
		const action = createMockStateAction(async () => {
			throw createUnauthorizedError();
		});

		const { result } = renderHook(() => useStateAction(action));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(result.current.status).toBe("hasNavigated");
		expect(result.current.hasNavigated).toBe(true);
	});

	test("component stays mounted after navigation error (not thrown to boundary)", async () => {
		const action = createMockStateAction(async () => {
			throw createRedirectError();
		});

		const { result } = renderHook(() => useStateAction(action), {
			wrapper: errorBoundaryWrapper,
		});

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(result.current.hasNavigated).toBe(true);
		expect(capturedBoundaryError).toBeNull();
	});
});

// ─── throwOnNavigation ──────────────────────────────────────────────────────

describe("useStateAction throwOnNavigation", () => {
	test("redirect error propagates to error boundary when throwOnNavigation is true", async () => {
		const redirectError = createRedirectError("/dashboard");
		const action = createMockStateAction(async () => {
			throw redirectError;
		});

		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

		const { result } = renderHook(() => useStateAction(action, { throwOnNavigation: true }), {
			wrapper: errorBoundaryWrapper,
		});

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(capturedBoundaryError).toBe(redirectError);

		consoleError.mockRestore();
	});

	test("notFound error propagates to error boundary when throwOnNavigation is true", async () => {
		const notFoundError = createNotFoundError();
		const action = createMockStateAction(async () => {
			throw notFoundError;
		});

		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

		const { result } = renderHook(() => useStateAction(action, { throwOnNavigation: true }), {
			wrapper: errorBoundaryWrapper,
		});

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(capturedBoundaryError).toBe(notFoundError);

		consoleError.mockRestore();
	});

	test("non-navigation errors are not affected by throwOnNavigation", async () => {
		const action = createMockStateAction(async () => ({
			serverError: "Internal error",
		}));

		const { result } = renderHook(() => useStateAction(action, { throwOnNavigation: true }), {
			wrapper: errorBoundaryWrapper,
		});

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(result.current.status).toBe("hasErrored");
		expect(capturedBoundaryError).toBeNull();
	});
});

// ─── Callbacks ──────────────────────────────────────────────────────────────

describe("useStateAction callbacks", () => {
	test("calls onExecute with input when action starts", async () => {
		let resolveAction!: (value: TestResult) => void;
		const action = createMockStateAction(
			() =>
				new Promise((resolve) => {
					resolveAction = resolve;
				})
		);
		const onExecute = vi.fn();

		const { result } = renderHook(() => useStateAction(action, { onExecute }));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(onExecute).toHaveBeenCalledWith({ input: undefined });

		await act(async () => {
			resolveAction({ data: { message: "done" } });
		});
		await flushHookTimers();
	});

	test("calls onSuccess with data and input on success", async () => {
		const action = createMockStateAction(async () => ({
			data: { message: "success" },
		}));
		const onSuccess = vi.fn();

		const { result } = renderHook(() => useStateAction(action, { onSuccess }));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(onSuccess).toHaveBeenCalledWith({
			data: { message: "success" },
			input: undefined,
		});
	});

	test("calls onSuccess exactly once (no double-fire)", async () => {
		const action = createMockStateAction(async () => ({
			data: { message: "once" },
		}));
		const onSuccess = vi.fn();

		const { result } = renderHook(() => useStateAction(action, { onSuccess }));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(onSuccess).toHaveBeenCalledTimes(1);
	});

	test("calls onError with error on validation error", async () => {
		const validationErrors = { _errors: ["Invalid"] } as any;
		const action = createMockStateAction(async () => ({ validationErrors }));
		const onError = vi.fn();

		const { result } = renderHook(() => useStateAction(action, { onError }));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(onError).toHaveBeenCalledWith({
			error: { validationErrors },
			input: undefined,
		});
	});

	test("calls onError with error on server error", async () => {
		const action = createMockStateAction(async () => ({
			serverError: "Internal error",
		}));
		const onError = vi.fn();

		const { result } = renderHook(() => useStateAction(action, { onError }));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(onError).toHaveBeenCalledWith({
			error: { serverError: "Internal error" },
			input: undefined,
		});
	});

	test("does not call onSuccess when action returns error", async () => {
		const action = createMockStateAction(async () => ({
			serverError: "error",
		}));
		const onSuccess = vi.fn();

		const { result } = renderHook(() => useStateAction(action, { onSuccess }));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(onSuccess).not.toHaveBeenCalled();
	});

	test("does not call onSuccess when navigation error occurs", async () => {
		const action = createMockStateAction(async () => {
			throw createRedirectError();
		});
		const onSuccess = vi.fn();

		const { result } = renderHook(() => useStateAction(action, { onSuccess }));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(onSuccess).not.toHaveBeenCalled();
	});

	test("calls onSettled after onSuccess", async () => {
		const action = createMockStateAction(async () => ({
			data: { message: "ok" },
		}));
		const onSettled = vi.fn();

		const { result } = renderHook(() => useStateAction(action, { onSettled }));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(onSettled).toHaveBeenCalledWith({
			result: { data: { message: "ok" } },
			input: undefined,
		});
	});

	test("calls onSettled after onError", async () => {
		const action = createMockStateAction(async () => ({
			serverError: "Boom",
		}));
		const onSettled = vi.fn();

		const { result } = renderHook(() => useStateAction(action, { onSettled }));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(onSettled).toHaveBeenCalledWith({
			result: { serverError: "Boom" },
			input: undefined,
		});
	});

	test("calls onSettled exactly once (no double-fire)", async () => {
		const action = createMockStateAction(async () => ({
			data: { message: "once" },
		}));
		const onSettled = vi.fn();

		const { result } = renderHook(() => useStateAction(action, { onSettled }));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(onSettled).toHaveBeenCalledTimes(1);
	});

	test("calls onNavigation with redirect kind", async () => {
		const action = createMockStateAction(async () => {
			throw createRedirectError("/home");
		});
		const onNavigation = vi.fn();

		const { result } = renderHook(() => useStateAction(action, { onNavigation }));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(onNavigation).toHaveBeenCalledWith({
			input: undefined,
			navigationKind: "redirect",
		});
	});

	test("calls onNavigation with notFound kind", async () => {
		const action = createMockStateAction(async () => {
			throw createNotFoundError();
		});
		const onNavigation = vi.fn();

		const { result } = renderHook(() => useStateAction(action, { onNavigation }));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(onNavigation).toHaveBeenCalledWith({
			input: undefined,
			navigationKind: "notFound",
		});
	});

	test("calls onSettled with navigationKind after navigation", async () => {
		const action = createMockStateAction(async () => {
			throw createRedirectError("/dashboard");
		});
		const onSettled = vi.fn();

		const { result } = renderHook(() => useStateAction(action, { onSettled }));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(onSettled).toHaveBeenCalledWith(
			expect.objectContaining({
				navigationKind: "redirect",
			})
		);
	});
});

// ─── Callback stability ────────────────────────────────────────────────────

describe("useStateAction callback stability", () => {
	test("changing callbacks between renders does not retrigger effects", async () => {
		const action = createMockStateAction(async () => ({
			data: { message: "ok" },
		}));
		const onSuccess1 = vi.fn();
		const onSuccess2 = vi.fn();

		const { result, rerender } = renderHook(
			({ onSuccess }: { onSuccess: typeof onSuccess1 }) => useStateAction(action, { onSuccess }),
			{ initialProps: { onSuccess: onSuccess1 } }
		);

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(onSuccess1).toHaveBeenCalledTimes(1);

		rerender({ onSuccess: onSuccess2 });

		await act(async () => {});

		expect(onSuccess2).not.toHaveBeenCalled();
	});
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe("useStateAction edge cases", () => {
	test("reset during execution persists: action result is hidden", async () => {
		// When reset() is called during execution, React's urgent updates (from reset)
		// take precedence over the transition's batched state. The user's explicit reset
		// is preserved even after the action completes in the background.
		let resolveAction!: (value: TestResult) => void;
		const action = createMockStateAction(
			() =>
				new Promise((resolve) => {
					resolveAction = resolve;
				})
		);

		const { result } = renderHook(() => useStateAction(action));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(result.current.isPending).toBe(true);

		// Reset while action is in flight
		act(() => {
			result.current.reset();
		});

		// Action completes after reset
		await act(async () => {
			resolveAction({ data: { message: "late result" } });
		});
		await flushHookTimers();

		// Reset persists: the result is hidden and status is idle
		expect(result.current.status).toBe("idle");
		expect(result.current.result).toEqual({});
	});

	test("multiple sequential actions each get correct prevResult", async () => {
		const prevResults: TestResult[] = [];
		const action = createMockStateAction(async (prevResult) => {
			prevResults.push(prevResult);
			return { data: { message: `result-${prevResults.length}` } };
		});

		const { result } = renderHook(() => useStateAction(action));

		// Call 1
		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		// Call 2
		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		// Call 3
		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(prevResults).toEqual([{}, { data: { message: "result-1" } }, { data: { message: "result-2" } }]);
	});

	test("reset clears navigation error state", async () => {
		const action = createMockStateAction(async () => {
			throw createRedirectError();
		});

		const { result } = renderHook(() => useStateAction(action));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(result.current.hasNavigated).toBe(true);

		// Reset should clear navigation state
		act(() => {
			result.current.reset();
		});

		expect(result.current.status).toBe("idle");
		expect(result.current.hasNavigated).toBe(false);
	});

	test("success after previous error shows correct status", async () => {
		// First action returns error
		const action = createMockStateAction(async () => ({
			serverError: "first call failed",
		}));

		const { result } = renderHook(() => useStateAction(action));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(result.current.hasErrored).toBe(true);

		// Change mock to return success for the next call
		action.mockImplementation(async () => ({
			data: { message: "recovered" },
		}));

		act(() => {
			result.current.execute(undefined);
		});
		await flushHookTimers();

		expect(result.current.status).toBe("hasSucceeded");
		expect(result.current.hasErrored).toBe(false);
	});
});
