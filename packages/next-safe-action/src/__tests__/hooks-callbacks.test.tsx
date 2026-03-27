import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAction } from "../hooks";
import type { HookCallbacks, SingleInputActionFn } from "../hooks.types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type TestActionFn = SingleInputActionFn<string, undefined, undefined, { message: string }>;
type TestCallbacks = HookCallbacks<string, undefined, undefined, { message: string }>;

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

// ─── onExecute ───────────────────────────────────────────────────────────────

describe("onExecute", () => {
	test("calls onExecute with input when action starts", async () => {
		let resolveAction!: (value: any) => void;
		const action = vi.fn<TestActionFn>().mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveAction = resolve;
				})
		);
		const onExecute = vi.fn();

		const { result } = renderHook(() => useAction(action, { onExecute }));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(onExecute).toHaveBeenCalledWith({ input: undefined });

		// Clean up.
		await act(async () => {
			resolveAction({ data: { message: "done" } });
		});
		await flushHookTimers();
	});
});

// ─── onSuccess ───────────────────────────────────────────────────────────────

describe("onSuccess", () => {
	test("calls onSuccess with data and input on success", async () => {
		const action = vi.fn<TestActionFn>().mockResolvedValue({
			data: { message: "success" },
		});
		const onSuccess = vi.fn();

		const { result } = renderHook(() => useAction(action, { onSuccess }));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(onSuccess).toHaveBeenCalledWith({
			data: { message: "success" },
			input: undefined,
		});
	});

	test("does not call onSuccess when thrownError is set", async () => {
		const action = vi.fn<TestActionFn>().mockRejectedValue(new Error("Boom"));
		const onSuccess = vi.fn();

		const { result } = renderHook(() => useAction(action, { onSuccess }));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(onSuccess).not.toHaveBeenCalled();
	});

	test("does not call onSuccess when navigationError is set", async () => {
		const action = vi.fn<TestActionFn>().mockRejectedValue(createRedirectError());
		const onSuccess = vi.fn();

		const { result } = renderHook(() => useAction(action, { onSuccess }));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(onSuccess).not.toHaveBeenCalled();
	});
});

// ─── onError ─────────────────────────────────────────────────────────────────

describe("onError", () => {
	test("calls onError with error and input on validation error", async () => {
		const validationErrors = { _errors: ["Invalid"] } as any;
		const action = vi.fn<TestActionFn>().mockResolvedValue({ validationErrors });
		const onError = vi.fn();

		const { result } = renderHook(() => useAction(action, { onError }));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(onError).toHaveBeenCalledWith({
			error: { validationErrors },
			input: undefined,
		});
	});

	test("calls onError with error and input on server error", async () => {
		const action = vi.fn<TestActionFn>().mockResolvedValue({
			serverError: "Internal error",
		});
		const onError = vi.fn();

		const { result } = renderHook(() => useAction(action, { onError }));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(onError).toHaveBeenCalledWith({
			error: { serverError: "Internal error" },
			input: undefined,
		});
	});

	test("includes thrownError in onError args when action throws", async () => {
		const thrownError = new Error("Network failure");
		const action = vi.fn<TestActionFn>().mockRejectedValue(thrownError);
		const onError = vi.fn();

		const { result } = renderHook(() => useAction(action, { onError }));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(onError).toHaveBeenCalledWith({
			error: { thrownError },
			input: undefined,
		});
	});
});

// ─── onSettled ───────────────────────────────────────────────────────────────

describe("onSettled", () => {
	test("calls onSettled after onSuccess", async () => {
		const action = vi.fn<TestActionFn>().mockResolvedValue({
			data: { message: "ok" },
		});
		const onSettled = vi.fn();

		const { result } = renderHook(() => useAction(action, { onSettled }));

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
		const action = vi.fn<TestActionFn>().mockResolvedValue({
			serverError: "Boom",
		});
		const onSettled = vi.fn();

		const { result } = renderHook(() => useAction(action, { onSettled }));

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(onSettled).toHaveBeenCalledWith({
			result: { serverError: "Boom" },
			input: undefined,
		});
	});

	test("calls onSettled with navigationKind after navigation", async () => {
		const action = vi.fn<TestActionFn>().mockRejectedValue(createRedirectError("/dashboard"));
		const onSettled = vi.fn();

		const { result } = renderHook(() => useAction(action, { onSettled }));

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

// ─── onNavigation ────────────────────────────────────────────────────────────

describe("onNavigation", () => {
	test("calls onNavigation with redirect kind", async () => {
		const action = vi.fn<TestActionFn>().mockRejectedValue(createRedirectError("/home"));
		const onNavigation = vi.fn();

		const { result } = renderHook(() => useAction(action, { onNavigation }));

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
		const action = vi.fn<TestActionFn>().mockRejectedValue(createNotFoundError());
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
});

// ─── Callback stability ─────────────────────────────────────────────────────

describe("callback stability", () => {
	test("changing callbacks between renders does not retrigger effects", async () => {
		const action = vi.fn<TestActionFn>().mockResolvedValue({
			data: { message: "ok" },
		});
		const onSuccess1 = vi.fn();
		const onSuccess2 = vi.fn();

		const { result, rerender } = renderHook(
			({ cb }: { cb: TestCallbacks }) => useAction(action, cb),
			{ initialProps: { cb: { onSuccess: onSuccess1 } } }
		);

		act(() => {
			result.current.execute(undefined);
		});

		await flushHookTimers();

		expect(onSuccess1).toHaveBeenCalledTimes(1);

		// Re-render with a new callback identity — should NOT retrigger the effect.
		rerender({ cb: { onSuccess: onSuccess2 } });

		await act(async () => {});

		// onSuccess2 should not have been called because the status didn't change.
		expect(onSuccess2).not.toHaveBeenCalled();
	});
});
