import { assertType, test } from "vitest";
import { useAction, useOptimisticAction } from "../../hooks";
import type { SingleInputActionFn } from "../../hooks.types";

type TestAction = SingleInputActionFn<string, undefined, undefined, { id: string }>;
declare const action: TestAction;

// ─── HookBaseOptions discriminated union ────────────────────────────────────

test("allows onNavigation when throwOnNavigation is false (default)", () => {
	assertType(
		useAction(action, {
			onNavigation: () => {},
			onSettled: () => {},
		})
	);
});

test("allows onNavigation when throwOnNavigation is explicitly false", () => {
	assertType(
		useAction(action, {
			throwOnNavigation: false,
			onNavigation: () => {},
			onSettled: () => {},
		})
	);
});

test("forbids onNavigation when throwOnNavigation is true", () => {
	useAction(action, {
		throwOnNavigation: true,
		// @ts-expect-error - onNavigation is not available when throwOnNavigation is true
		onNavigation: () => {},
	});
});

test("forbids onSettled when throwOnNavigation is true", () => {
	useAction(action, {
		throwOnNavigation: true,
		// @ts-expect-error - onSettled is not available when throwOnNavigation is true
		onSettled: () => {},
	});
});

test("allows other callbacks when throwOnNavigation is true", () => {
	assertType(
		useAction(action, {
			throwOnNavigation: true,
			onExecute: () => {},
			onSuccess: () => {},
			onError: () => {},
		})
	);
});

test("allows throwOnNavigation: true with no callbacks", () => {
	assertType(useAction(action, { throwOnNavigation: true }));
});

// ─── useOptimisticAction respects the same constraints ──────────────────────

test("useOptimisticAction forbids onNavigation when throwOnNavigation is true", () => {
	useOptimisticAction(action, {
		currentState: { count: 0 },
		updateFn: (state: { count: number }) => ({ count: state.count + 1 }),
		throwOnNavigation: true,
		// @ts-expect-error - onNavigation is not available when throwOnNavigation is true
		onNavigation: () => {},
	});
});

test("useOptimisticAction allows onNavigation by default", () => {
	assertType(
		useOptimisticAction(action, {
			currentState: { count: 0 },
			updateFn: (state: { count: number }) => ({ count: state.count + 1 }),
			onNavigation: () => {},
			onSettled: () => {},
		})
	);
});
