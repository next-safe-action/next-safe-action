// Verifies that hook return types form a discriminated union keyed on `status`
// and shorthand booleans (`hasSucceeded`, `hasErrored`, etc.). Checking any
// discriminant narrows the `result` type accordingly.

import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import type {
	UseActionHookReturn,
	UseStateActionHookReturn,
	UseOptimisticActionHookReturn,
	InferUseActionHookReturn,
	InferUseOptimisticActionHookReturn,
	InferUseStateActionHookReturn,
	HookActionStatus,
	HookIdleResult,
	HookSuccessResult,
	HookErrorResult,
} from "../../hooks.types";
import type { SafeActionFn, SafeStateActionFn } from "../../index.types";
import type { ValidationErrors } from "../../validation-errors.types";

const schema = z.object({ name: z.string() });

type Data = { id: string };
type ServerError = string;
type Shape = ValidationErrors<typeof schema>;
type Return = UseActionHookReturn<ServerError, typeof schema, Shape, Data>;

// ─── Core properties ────────────────────────────────────────────────────────

test("UseActionHookReturn has execute, executeAsync, input, result, reset, status", () => {
	// Core properties exist
	expectTypeOf<Return["execute"]>().not.toBeAny();
	expectTypeOf<Return["executeAsync"]>().not.toBeAny();
	expectTypeOf<Return["input"]>().not.toBeAny();
	expectTypeOf<Return["result"]>().not.toBeAny();
	expectTypeOf<Return["reset"]>().toEqualTypeOf<() => void>();
	expectTypeOf<Return["status"]>().toEqualTypeOf<HookActionStatus>();
});

test("UseActionHookReturn execute accepts correct input type", () => {
	// execute takes schema input
	expectTypeOf<Return["execute"]>().toEqualTypeOf<(input: { name: string }) => void>();
});

test("UseActionHookReturn result.data matches action return type", () => {
	expectTypeOf<Return["result"]["data"]>().toEqualTypeOf<Data | undefined>();
	expectTypeOf<Return["result"]["serverError"]>().toEqualTypeOf<ServerError | undefined>();
});

test("UseActionHookReturn result narrows on truthy data", () => {
	const ret = {} as Return;

	if (ret.result.data) {
		expectTypeOf(ret.result.data).toEqualTypeOf<Data>();
		expectTypeOf(ret.result.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(ret.result.validationErrors).toEqualTypeOf<undefined>();
	}
});

test("UseActionHookReturn result destructuring narrows together", () => {
	const ret = {} as Return;
	const { data, serverError, validationErrors } = ret.result;

	if (data) {
		expectTypeOf(data).toEqualTypeOf<Data>();
		expectTypeOf(serverError).toEqualTypeOf<undefined>();
		expectTypeOf(validationErrors).toEqualTypeOf<undefined>();
	}
});

test("UseActionHookReturn has shorthand status booleans", () => {
	// Across the whole union, each boolean is `true | false` = `boolean`
	expectTypeOf<Return["isIdle"]>().toEqualTypeOf<boolean>();
	expectTypeOf<Return["isExecuting"]>().toEqualTypeOf<boolean>();
	expectTypeOf<Return["isTransitioning"]>().toEqualTypeOf<boolean>();
	expectTypeOf<Return["isPending"]>().toEqualTypeOf<boolean>();
	expectTypeOf<Return["hasSucceeded"]>().toEqualTypeOf<boolean>();
	expectTypeOf<Return["hasErrored"]>().toEqualTypeOf<boolean>();
	expectTypeOf<Return["hasNavigated"]>().toEqualTypeOf<boolean>();
});

test("void-returning action: UseActionHookReturn result.data is exactly `undefined`", () => {
	// When the action returns nothing, `result.data` should narrow to `undefined`
	// rather than `void | undefined`. This mirrors the `await action()` behavior
	// at the hook layer so users see the same type regardless of how they invoke.
	type VoidReturn = UseActionHookReturn<string, undefined, undefined, void>;
	expectTypeOf<VoidReturn["result"]["data"]>().toEqualTypeOf<undefined>();
});

// ─── Status-based narrowing (discriminated union) ───────────────────────────

test("status === 'hasSucceeded' narrows result to success branch", () => {
	const ret = {} as Return;

	if (ret.status === "hasSucceeded") {
		expectTypeOf(ret.result.data).toEqualTypeOf<Data>();
		expectTypeOf(ret.result.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(ret.result.validationErrors).toEqualTypeOf<undefined>();
		expectTypeOf(ret.hasSucceeded).toEqualTypeOf<true>();
		expectTypeOf(ret.hasErrored).toEqualTypeOf<false>();
		expectTypeOf(ret.isIdle).toEqualTypeOf<false>();
		expectTypeOf(ret.isExecuting).toEqualTypeOf<false>();
	}
});

test("status === 'hasErrored' narrows result to error branches (data is always undefined)", () => {
	const ret = {} as Return;

	if (ret.status === "hasErrored") {
		expectTypeOf(ret.result.data).toEqualTypeOf<undefined>();
		expectTypeOf(ret.hasErrored).toEqualTypeOf<true>();
		expectTypeOf(ret.hasSucceeded).toEqualTypeOf<false>();
		expectTypeOf(ret.isIdle).toEqualTypeOf<false>();
		expectTypeOf(ret.isExecuting).toEqualTypeOf<false>();
	}
});

test("status === 'hasErrored' allows further narrowing on serverError", () => {
	const ret = {} as Return;

	if (ret.status === "hasErrored") {
		if (ret.result.serverError) {
			expectTypeOf(ret.result.serverError).toEqualTypeOf<ServerError>();
			expectTypeOf(ret.result.validationErrors).toEqualTypeOf<undefined>();
		}
	}
});

test("status === 'hasErrored' allows further narrowing on validationErrors", () => {
	const ret = {} as Return;

	if (ret.status === "hasErrored") {
		if (ret.result.validationErrors) {
			expectTypeOf(ret.result.validationErrors).toEqualTypeOf<Shape>();
			expectTypeOf(ret.result.serverError).toEqualTypeOf<undefined>();
		}
	}
});

test("status === 'idle' narrows result to idle (empty) shape", () => {
	const ret = {} as Return;

	if (ret.status === "idle") {
		expectTypeOf(ret.result.data).toEqualTypeOf<undefined>();
		expectTypeOf(ret.result.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(ret.result.validationErrors).toEqualTypeOf<undefined>();
		expectTypeOf(ret.isIdle).toEqualTypeOf<true>();
		expectTypeOf(ret.isExecuting).toEqualTypeOf<false>();
		expectTypeOf(ret.hasSucceeded).toEqualTypeOf<false>();
	}
});

test("status === 'executing' narrows booleans to literal types", () => {
	const ret = {} as Return;

	if (ret.status === "executing") {
		expectTypeOf(ret.isExecuting).toEqualTypeOf<true>();
		expectTypeOf(ret.isPending).toEqualTypeOf<true>();
		expectTypeOf(ret.isIdle).toEqualTypeOf<false>();
		expectTypeOf(ret.hasSucceeded).toEqualTypeOf<false>();
		expectTypeOf(ret.hasErrored).toEqualTypeOf<false>();
	}
});

test("status === 'hasNavigated' narrows result to idle (empty) shape", () => {
	const ret = {} as Return;

	if (ret.status === "hasNavigated") {
		expectTypeOf(ret.result.data).toEqualTypeOf<undefined>();
		expectTypeOf(ret.result.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(ret.hasNavigated).toEqualTypeOf<true>();
		expectTypeOf(ret.hasSucceeded).toEqualTypeOf<false>();
		expectTypeOf(ret.hasErrored).toEqualTypeOf<false>();
	}
});

// ─── Shorthand boolean narrowing ────────────────────────────────────────────

test("hasSucceeded (shorthand) narrows result to success branch", () => {
	const ret = {} as Return;

	if (ret.hasSucceeded) {
		expectTypeOf(ret.result.data).toEqualTypeOf<Data>();
		expectTypeOf(ret.result.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(ret.result.validationErrors).toEqualTypeOf<undefined>();
		expectTypeOf(ret.status).toEqualTypeOf<"hasSucceeded">();
	}
});

test("hasErrored (shorthand) narrows result, data is always undefined", () => {
	const ret = {} as Return;

	if (ret.hasErrored) {
		expectTypeOf(ret.result.data).toEqualTypeOf<undefined>();
		expectTypeOf(ret.status).toEqualTypeOf<"hasErrored">();
	}
});

test("isIdle (shorthand) narrows to idle state", () => {
	const ret = {} as Return;

	if (ret.isIdle) {
		expectTypeOf(ret.result.data).toEqualTypeOf<undefined>();
		expectTypeOf(ret.status).toEqualTypeOf<"idle">();
	}
});

test("isExecuting (shorthand) narrows to executing state", () => {
	const ret = {} as Return;

	if (ret.isExecuting) {
		expectTypeOf(ret.status).toEqualTypeOf<"executing">();
		expectTypeOf(ret.isPending).toEqualTypeOf<true>();
	}
});

// ─── Destructured narrowing (TS 4.6+ discriminated union destructuring) ─────

test("destructured status narrows result", () => {
	const { status, result } = {} as Return;

	if (status === "hasSucceeded") {
		expectTypeOf(result.data).toEqualTypeOf<Data>();
		expectTypeOf(result.serverError).toEqualTypeOf<undefined>();
	}
});

test("destructured hasSucceeded narrows result", () => {
	const { hasSucceeded, result } = {} as Return;

	if (hasSucceeded) {
		expectTypeOf(result.data).toEqualTypeOf<Data>();
		expectTypeOf(result.serverError).toEqualTypeOf<undefined>();
	}
});

test("destructured hasErrored narrows result", () => {
	const { hasErrored, result } = {} as Return;

	if (hasErrored) {
		expectTypeOf(result.data).toEqualTypeOf<undefined>();
	}
});

// ─── Void-returning action narrowing ────────────────────────────────────────

test("void action: hasSucceeded narrows result.data to undefined", () => {
	type VoidReturn = UseActionHookReturn<string, undefined, undefined, void>;
	const ret = {} as VoidReturn;

	if (ret.hasSucceeded) {
		// Void actions never produce a data field, so success result.data stays undefined
		expectTypeOf(ret.result.data).toEqualTypeOf<undefined>();
	}
});

// ─── UseOptimisticActionHookReturn ──────────────────────────────────────────

test("UseOptimisticActionHookReturn includes optimisticState", () => {
	type Return = UseOptimisticActionHookReturn<string, undefined, undefined, void, { count: number }>;

	expectTypeOf<Return["optimisticState"]>().toEqualTypeOf<{ count: number }>();
	// Also has all UseActionHookReturn properties
	expectTypeOf<Return["execute"]>().not.toBeAny();
	expectTypeOf<Return["status"]>().toEqualTypeOf<HookActionStatus>();
});

test("UseOptimisticActionHookReturn preserves discriminated union narrowing", () => {
	type OptReturn = UseOptimisticActionHookReturn<ServerError, typeof schema, Shape, Data, { count: number }>;
	const ret = {} as OptReturn;

	if (ret.hasSucceeded) {
		expectTypeOf(ret.result.data).toEqualTypeOf<Data>();
		expectTypeOf(ret.result.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(ret.optimisticState).toEqualTypeOf<{ count: number }>();
		expectTypeOf(ret.status).toEqualTypeOf<"hasSucceeded">();
	}
});

// ─── UseStateActionHookReturn ───────────────────────────────────────────────

test("UseStateActionHookReturn has execute, executeAsync, reset, and formAction", () => {
	type Return = UseStateActionHookReturn<string, undefined, undefined, void>;

	// Has all core properties from UseActionHookReturn
	expectTypeOf<Return["execute"]>().not.toBeAny();
	expectTypeOf<Return["executeAsync"]>().not.toBeAny();
	expectTypeOf<Return["reset"]>().toEqualTypeOf<() => void>();
	expectTypeOf<Return["status"]>().toEqualTypeOf<HookActionStatus>();

	// Has formAction (unique to UseStateActionHookReturn)
	type HasFormAction = "formAction" extends keyof Return ? true : false;
	expectTypeOf<HasFormAction>().toEqualTypeOf<true>();
});

test("UseStateActionHookReturn preserves discriminated union narrowing", () => {
	type StateReturn = UseStateActionHookReturn<ServerError, typeof schema, Shape, Data>;
	const ret = {} as StateReturn;

	if (ret.hasSucceeded) {
		expectTypeOf(ret.result.data).toEqualTypeOf<Data>();
		expectTypeOf(ret.result.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(ret.status).toEqualTypeOf<"hasSucceeded">();
	}

	if (ret.hasErrored) {
		expectTypeOf(ret.result.data).toEqualTypeOf<undefined>();
		expectTypeOf(ret.status).toEqualTypeOf<"hasErrored">();
	}
});

test("UseStateActionHookReturn has all UseActionHookReturn properties plus formAction", () => {
	type Return = UseStateActionHookReturn<string, typeof schema, ValidationErrors<typeof schema>, { id: string }>;

	// Has all the same properties as UseActionHookReturn
	expectTypeOf<Return["execute"]>().toEqualTypeOf<(input: { name: string }) => void>();
	expectTypeOf<Return["executeAsync"]>().not.toBeAny();
	expectTypeOf<Return["reset"]>().toEqualTypeOf<() => void>();
	expectTypeOf<Return["input"]>().not.toBeAny();
	expectTypeOf<Return["result"]>().not.toBeAny();
	expectTypeOf<Return["status"]>().toEqualTypeOf<HookActionStatus>();

	// Has shorthand status booleans
	expectTypeOf<Return["isIdle"]>().toEqualTypeOf<boolean>();
	expectTypeOf<Return["isPending"]>().toEqualTypeOf<boolean>();
	expectTypeOf<Return["hasNavigated"]>().toEqualTypeOf<boolean>();

	// Has formAction (unique to UseStateActionHookReturn)
	expectTypeOf<Return["formAction"]>().not.toBeAny();

	// result.data matches action return type
	expectTypeOf<Return["result"]["data"]>().toEqualTypeOf<{ id: string } | undefined>();
});

// ─── Infer utility types ────────────────────────────────────────────────────

test("InferUseActionHookReturn extracts return type from SafeActionFn", () => {
	type ActionFn = SafeActionFn<string, typeof schema, [], ValidationErrors<typeof schema>, { id: string }>;
	type Return = InferUseActionHookReturn<ActionFn>;

	expectTypeOf<Return["result"]["data"]>().toEqualTypeOf<{ id: string } | undefined>();
	expectTypeOf<Return>().not.toBeAny();
});

test("InferUseOptimisticActionHookReturn extracts return type", () => {
	type ActionFn = SafeActionFn<string, typeof schema, [], ValidationErrors<typeof schema>, { id: string }>;
	type Return = InferUseOptimisticActionHookReturn<ActionFn, { count: number }>;

	expectTypeOf<Return["optimisticState"]>().toEqualTypeOf<{ count: number }>();
	expectTypeOf<Return>().not.toBeAny();
});

test("InferUseStateActionHookReturn extracts from SafeStateActionFn", () => {
	type StateActionFn = SafeStateActionFn<string, typeof schema, [], ValidationErrors<typeof schema>, { id: string }>;
	type Return = InferUseStateActionHookReturn<StateActionFn>;

	expectTypeOf<Return["result"]["data"]>().toEqualTypeOf<{ id: string } | undefined>();
	expectTypeOf<Return>().not.toBeAny();
});

// ─── Result helper types ────────────────────────────────────────────────────

test("HookIdleResult has all fields optional/undefined", () => {
	expectTypeOf<HookIdleResult["data"]>().toEqualTypeOf<undefined>();
	expectTypeOf<HookIdleResult["serverError"]>().toEqualTypeOf<undefined>();
	expectTypeOf<HookIdleResult["validationErrors"]>().toEqualTypeOf<undefined>();
});

test("HookSuccessResult: non-void Data produces data: Data", () => {
	type Result = HookSuccessResult<{ id: string }>;
	expectTypeOf<Result["data"]>().toEqualTypeOf<{ id: string }>();
	expectTypeOf<Result["serverError"]>().toEqualTypeOf<undefined>();
});

test("HookSuccessResult: void Data collapses to HookIdleResult", () => {
	type Result = HookSuccessResult<void>;
	expectTypeOf<Result>().toEqualTypeOf<HookIdleResult>();
});

test("HookErrorResult allows narrowing on serverError or validationErrors", () => {
	type Result = HookErrorResult<string, Shape>;
	const r = {} as Result;

	if (r.serverError) {
		expectTypeOf(r.serverError).toEqualTypeOf<string>();
		expectTypeOf(r.validationErrors).toEqualTypeOf<undefined>();
	}

	if (r.validationErrors) {
		expectTypeOf(r.validationErrors).toEqualTypeOf<Shape>();
		expectTypeOf(r.serverError).toEqualTypeOf<undefined>();
	}
});
