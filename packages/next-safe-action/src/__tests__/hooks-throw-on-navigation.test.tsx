import { renderHook, act } from "@testing-library/react";
import * as React from "react";
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

// ─── Default behavior (throwOnNavigation: false) ────────────────────────────

describe("default behavior (throwOnNavigation: false)", () => {
	test("notFound error sets hasNavigated status", async () => {
		const notFoundError = createNotFoundError();
		const action = vi.fn<TestActionFn>().mockRejectedValue(notFoundError);

		const { result } = renderHook(() => useAction(action));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.status).toBe("hasNavigated");
		expect(result.current.hasNavigated).toBe(true);
		expect(capturedBoundaryError).toBeNull();
	});

	test("forbidden error sets hasNavigated status", async () => {
		const forbiddenError = createForbiddenError();
		const action = vi.fn<TestActionFn>().mockRejectedValue(forbiddenError);

		const { result } = renderHook(() => useAction(action));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.status).toBe("hasNavigated");
		expect(result.current.hasNavigated).toBe(true);
		expect(capturedBoundaryError).toBeNull();
	});

	test("unauthorized error sets hasNavigated status", async () => {
		const unauthorizedError = createUnauthorizedError();
		const action = vi.fn<TestActionFn>().mockRejectedValue(unauthorizedError);

		const { result } = renderHook(() => useAction(action));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.status).toBe("hasNavigated");
		expect(result.current.hasNavigated).toBe(true);
		expect(capturedBoundaryError).toBeNull();
	});

	test("onNavigation callback fires by default", async () => {
		const notFoundError = createNotFoundError();
		const action = vi.fn<TestActionFn>().mockRejectedValue(notFoundError);
		const onNavigation = vi.fn();

		const { result } = renderHook(() => useAction(action, { onNavigation }));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(onNavigation).toHaveBeenCalledWith({
			input: undefined,
			navigationKind: "notFound",
		});
	});

	test("onSettled callback fires with navigationKind by default", async () => {
		const forbiddenError = createForbiddenError();
		const action = vi.fn<TestActionFn>().mockRejectedValue(forbiddenError);
		const onSettled = vi.fn();

		const { result } = renderHook(() => useAction(action, { onSettled }));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(onSettled).toHaveBeenCalledWith(
			expect.objectContaining({
				navigationKind: "forbidden",
			})
		);
	});

	test("non-navigation errors are not affected", async () => {
		const regularError = new Error("Network failure");
		const action = vi.fn<TestActionFn>().mockRejectedValue(regularError);

		const { result } = renderHook(() => useAction(action));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.status).toBe("hasErrored");
		expect(result.current.hasErrored).toBe(true);
		expect(capturedBoundaryError).toBeNull();
	});

	test("useOptimisticAction catches navigation errors by default", async () => {
		const notFoundError = createNotFoundError();
		const action = vi.fn<TestActionFn>().mockRejectedValue(notFoundError);

		const { result } = renderHook(() =>
			useOptimisticAction(action, {
				currentState: { count: 0 },
				updateFn: (state: { count: number }) => ({ count: state.count + 1 }),
			})
		);

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(result.current.status).toBe("hasNavigated");
		expect(result.current.hasNavigated).toBe(true);
		expect(capturedBoundaryError).toBeNull();
	});
});

// ─── throwOnNavigation: true (opt-in) ──────────────────────────────────────

describe("throwOnNavigation: true (opt-in)", () => {
	test("notFound error propagates to error boundary", async () => {
		const notFoundError = createNotFoundError();
		const action = vi.fn<TestActionFn>().mockRejectedValue(notFoundError);

		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

		const { result } = renderHook(() => useAction(action, { throwOnNavigation: true }), {
			wrapper: errorBoundaryWrapper,
		});

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(capturedBoundaryError).toBe(notFoundError);

		consoleError.mockRestore();
	});

	test("forbidden error propagates to error boundary", async () => {
		const forbiddenError = createForbiddenError();
		const action = vi.fn<TestActionFn>().mockRejectedValue(forbiddenError);

		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

		const { result } = renderHook(() => useAction(action, { throwOnNavigation: true }), {
			wrapper: errorBoundaryWrapper,
		});

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(capturedBoundaryError).toBe(forbiddenError);

		consoleError.mockRestore();
	});

	test("unauthorized error propagates to error boundary", async () => {
		const unauthorizedError = createUnauthorizedError();
		const action = vi.fn<TestActionFn>().mockRejectedValue(unauthorizedError);

		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

		const { result } = renderHook(() => useAction(action, { throwOnNavigation: true }), {
			wrapper: errorBoundaryWrapper,
		});

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(capturedBoundaryError).toBe(unauthorizedError);

		consoleError.mockRestore();
	});

	test("redirect error propagates to error boundary", async () => {
		const redirectError = createRedirectError("/dashboard");
		const action = vi.fn<TestActionFn>().mockRejectedValue(redirectError);

		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

		const { result } = renderHook(() => useAction(action, { throwOnNavigation: true }), {
			wrapper: errorBoundaryWrapper,
		});

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(capturedBoundaryError).toBe(redirectError);

		consoleError.mockRestore();
	});

	test("executeAsync promise still rejects on navigation error", async () => {
		const notFoundError = createNotFoundError();
		const action = vi.fn<TestActionFn>().mockRejectedValue(notFoundError);

		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

		const { result } = renderHook(() => useAction(action, { throwOnNavigation: true }), {
			wrapper: errorBoundaryWrapper,
		});

		let rejectedError: unknown;
		act(() => {
			void result.current.executeAsync(undefined).catch((e) => {
				rejectedError = e;
			});
		});

		await flushHookTimers();

		expect(rejectedError).toBe(notFoundError);
		expect(capturedBoundaryError).toBe(notFoundError);

		consoleError.mockRestore();
	});

	test("useOptimisticAction propagates navigation errors to error boundary", async () => {
		const notFoundError = createNotFoundError();
		const action = vi.fn<TestActionFn>().mockRejectedValue(notFoundError);

		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

		const { result } = renderHook(
			() =>
				useOptimisticAction(action, {
					currentState: { count: 0 },
					updateFn: (state: { count: number }) => ({ count: state.count + 1 }),
					throwOnNavigation: true,
				}),
			{ wrapper: errorBoundaryWrapper }
		);

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(capturedBoundaryError).toBe(notFoundError);

		consoleError.mockRestore();
	});
});
