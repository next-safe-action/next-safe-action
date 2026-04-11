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
} from "../../hooks.types";
import type { SafeActionFn, SafeStateActionFn } from "../../index.types";
import type { ValidationErrors } from "../../validation-errors.types";

test("UseActionHookReturn has execute, executeAsync, input, result, reset, status", () => {
	const schema = z.object({ name: z.string() });
	type Return = UseActionHookReturn<string, typeof schema, ValidationErrors<typeof schema>, { id: string }>;

	// Core properties exist
	expectTypeOf<Return["execute"]>().not.toBeAny();
	expectTypeOf<Return["executeAsync"]>().not.toBeAny();
	expectTypeOf<Return["input"]>().not.toBeAny();
	expectTypeOf<Return["result"]>().not.toBeAny();
	expectTypeOf<Return["reset"]>().toEqualTypeOf<() => void>();
	expectTypeOf<Return["status"]>().toEqualTypeOf<HookActionStatus>();
});

test("UseActionHookReturn execute accepts correct input type", () => {
	const schema = z.object({ name: z.string() });
	type Return = UseActionHookReturn<string, typeof schema, ValidationErrors<typeof schema>, { id: string }>;

	// execute takes schema input
	expectTypeOf<Return["execute"]>().toEqualTypeOf<(input: { name: string }) => void>();
});

test("UseActionHookReturn result.data matches action return type", () => {
	const schema = z.object({ name: z.string() });
	type Return = UseActionHookReturn<string, typeof schema, ValidationErrors<typeof schema>, { id: string }>;

	expectTypeOf<Return["result"]["data"]>().toEqualTypeOf<{ id: string } | undefined>();
	expectTypeOf<Return["result"]["serverError"]>().toEqualTypeOf<string | undefined>();
});

test("UseActionHookReturn result narrows on truthy data", () => {
	const schema = z.object({ name: z.string() });
	type Return = UseActionHookReturn<string, typeof schema, ValidationErrors<typeof schema>, { id: string }>;
	const ret = {} as Return;

	if (ret.result.data) {
		expectTypeOf(ret.result.data).toEqualTypeOf<{ id: string }>();
		expectTypeOf(ret.result.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(ret.result.validationErrors).toEqualTypeOf<undefined>();
	}
});

test("UseActionHookReturn result destructuring narrows together", () => {
	const schema = z.object({ name: z.string() });
	type Return = UseActionHookReturn<string, typeof schema, ValidationErrors<typeof schema>, { id: string }>;
	const ret = {} as Return;
	const { data, serverError, validationErrors } = ret.result;

	if (data) {
		expectTypeOf(data).toEqualTypeOf<{ id: string }>();
		expectTypeOf(serverError).toEqualTypeOf<undefined>();
		expectTypeOf(validationErrors).toEqualTypeOf<undefined>();
	}
});

test("UseActionHookReturn has shorthand status booleans", () => {
	type Return = UseActionHookReturn<string, undefined, undefined, void>;

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
	type Return = UseActionHookReturn<string, undefined, undefined, void>;
	expectTypeOf<Return["result"]["data"]>().toEqualTypeOf<undefined>();
});

test("UseOptimisticActionHookReturn includes optimisticState", () => {
	type Return = UseOptimisticActionHookReturn<string, undefined, undefined, void, { count: number }>;

	expectTypeOf<Return["optimisticState"]>().toEqualTypeOf<{ count: number }>();
	// Also has all UseActionHookReturn properties
	expectTypeOf<Return["execute"]>().not.toBeAny();
	expectTypeOf<Return["status"]>().toEqualTypeOf<HookActionStatus>();
});

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

test("InferUseActionHookReturn extracts return type from SafeActionFn", () => {
	const schema = z.object({ name: z.string() });
	type ActionFn = SafeActionFn<string, typeof schema, [], ValidationErrors<typeof schema>, { id: string }>;
	type Return = InferUseActionHookReturn<ActionFn>;

	expectTypeOf<Return["result"]["data"]>().toEqualTypeOf<{ id: string } | undefined>();
	expectTypeOf<Return>().not.toBeAny();
});

test("InferUseOptimisticActionHookReturn extracts return type", () => {
	const schema = z.object({ name: z.string() });
	type ActionFn = SafeActionFn<string, typeof schema, [], ValidationErrors<typeof schema>, { id: string }>;
	type Return = InferUseOptimisticActionHookReturn<ActionFn, { count: number }>;

	expectTypeOf<Return["optimisticState"]>().toEqualTypeOf<{ count: number }>();
	expectTypeOf<Return>().not.toBeAny();
});

test("InferUseStateActionHookReturn extracts from SafeStateActionFn", () => {
	const schema = z.object({ name: z.string() });
	type StateActionFn = SafeStateActionFn<string, typeof schema, [], ValidationErrors<typeof schema>, { id: string }>;
	type Return = InferUseStateActionHookReturn<StateActionFn>;

	expectTypeOf<Return["result"]["data"]>().toEqualTypeOf<{ id: string } | undefined>();
	expectTypeOf<Return>().not.toBeAny();
});

test("UseStateActionHookReturn has all UseActionHookReturn properties plus formAction", () => {
	const schema = z.object({ name: z.string() });
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
