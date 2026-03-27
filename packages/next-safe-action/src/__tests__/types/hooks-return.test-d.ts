import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import type { SafeActionFn, SafeStateActionFn } from "../../index.types";
import type {
	UseActionHookReturn,
	UseStateActionHookReturn,
	UseOptimisticActionHookReturn,
	InferUseActionHookReturn,
	InferUseOptimisticActionHookReturn,
	InferUseStateActionHookReturn,
	HookActionStatus,
} from "../../hooks.types";
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

test("UseOptimisticActionHookReturn includes optimisticState", () => {
	type Return = UseOptimisticActionHookReturn<string, undefined, undefined, void, { count: number }>;

	expectTypeOf<Return["optimisticState"]>().toEqualTypeOf<{ count: number }>();
	// Also has all UseActionHookReturn properties
	expectTypeOf<Return["execute"]>().not.toBeAny();
	expectTypeOf<Return["status"]>().toEqualTypeOf<HookActionStatus>();
});

test("UseStateActionHookReturn omits executeAsync and reset", () => {
	type Return = UseStateActionHookReturn<string, undefined, undefined, void>;

	// Has execute but not executeAsync or reset
	expectTypeOf<Return["execute"]>().not.toBeAny();
	expectTypeOf<Return["status"]>().toEqualTypeOf<HookActionStatus>();

	// These should not exist on UseStateActionHookReturn
	type HasExecuteAsync = "executeAsync" extends keyof Return ? true : false;
	expectTypeOf<HasExecuteAsync>().toEqualTypeOf<false>();

	type HasReset = "reset" extends keyof Return ? true : false;
	expectTypeOf<HasReset>().toEqualTypeOf<false>();
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
