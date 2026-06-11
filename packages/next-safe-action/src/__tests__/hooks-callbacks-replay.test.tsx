import { act, render } from "@testing-library/react";
import { Activity } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAction } from "../hooks";
import type { HookCallbacks, SingleInputActionFn } from "../hooks.types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type TestActionFn = SingleInputActionFn<string, undefined, undefined, { message: string }>;
type TestCallbacks = HookCallbacks<string, undefined, undefined, { message: string }>;

type ExecuteRef = { current: ((input: undefined) => void) | null };

/**
 * Renders `useAction` inside a component tree so it can be wrapped in an
 * `<Activity>` boundary, and exposes `execute` through a mutable ref.
 */
function ActionHarness({
	action,
	callbacks,
	executeRef,
}: {
	action: TestActionFn;
	callbacks?: TestCallbacks;
	executeRef: ExecuteRef;
}) {
	const { execute } = useAction(action, callbacks);
	executeRef.current = execute;
	return null;
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

// ─── <Activity> replay (Next.js router bfcache) ──────────────────────────────

// When a page is restored from the Next.js router bfcache (`cacheComponents`),
// React `<Activity>` preserves the hook state but cleans up and re-runs all
// effects. The callbacks effect must not re-fire for an execution it already
// handled. See https://github.com/next-safe-action/next-safe-action/issues/454
describe("<Activity> hide/show (router bfcache restore)", () => {
	test("does not replay onSuccess/onSettled for an already-handled execution", async () => {
		const action = vi.fn<TestActionFn>().mockResolvedValue({
			data: { message: "success" },
		});
		const onSuccess = vi.fn();
		const onSettled = vi.fn();
		const executeRef: ExecuteRef = { current: null };

		const ui = (mode: "visible" | "hidden") => (
			<Activity mode={mode}>
				<ActionHarness action={action} callbacks={{ onSuccess, onSettled }} executeRef={executeRef} />
			</Activity>
		);

		const { rerender } = render(ui("visible"));

		act(() => {
			executeRef.current!(undefined);
		});

		await flushHookTimers();

		expect(onSuccess).toHaveBeenCalledTimes(1);
		expect(onSettled).toHaveBeenCalledTimes(1);

		// Hide, then re-show: state is preserved, effects re-run.
		await act(async () => {
			rerender(ui("hidden"));
		});
		await act(async () => {
			rerender(ui("visible"));
		});

		await flushHookTimers();

		expect(onSuccess).toHaveBeenCalledTimes(1);
		expect(onSettled).toHaveBeenCalledTimes(1);

		// A new execution after the restore fires the callbacks again.
		act(() => {
			executeRef.current!(undefined);
		});

		await flushHookTimers();

		expect(onSuccess).toHaveBeenCalledTimes(2);
		expect(onSettled).toHaveBeenCalledTimes(2);
	});

	test("does not replay onError/onSettled for an already-handled execution", async () => {
		const action = vi.fn<TestActionFn>().mockResolvedValue({
			serverError: "Server error",
		});
		const onError = vi.fn();
		const onSettled = vi.fn();
		const executeRef: ExecuteRef = { current: null };

		const ui = (mode: "visible" | "hidden") => (
			<Activity mode={mode}>
				<ActionHarness action={action} callbacks={{ onError, onSettled }} executeRef={executeRef} />
			</Activity>
		);

		const { rerender } = render(ui("visible"));

		act(() => {
			executeRef.current!(undefined);
		});

		await flushHookTimers();

		expect(onError).toHaveBeenCalledTimes(1);
		expect(onSettled).toHaveBeenCalledTimes(1);

		// Hide, then re-show: state is preserved, effects re-run.
		await act(async () => {
			rerender(ui("hidden"));
		});
		await act(async () => {
			rerender(ui("visible"));
		});

		await flushHookTimers();

		expect(onError).toHaveBeenCalledTimes(1);
		expect(onSettled).toHaveBeenCalledTimes(1);
	});
});
