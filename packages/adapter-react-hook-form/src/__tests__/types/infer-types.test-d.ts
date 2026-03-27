import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import type { SafeActionFn } from "next-safe-action";
import type { HookActionStatus } from "next-safe-action/hooks";
import type {
	InferUseHookFormActionHookReturn,
	InferUseHookFormOptimisticActionHookReturn,
} from "../../hooks.types";
import type { ValidationErrors } from "next-safe-action";

// ─── InferUseHookFormActionHookReturn ─────────────────────────────────

test("InferUseHookFormActionHookReturn extracts return type from SafeActionFn", () => {
	const schema = z.object({ name: z.string() });
	type ActionFn = SafeActionFn<string, typeof schema, [], ValidationErrors<typeof schema>, { id: string }>;
	type Return = InferUseHookFormActionHookReturn<ActionFn>;

	expectTypeOf<Return>().not.toBeAny();
	expectTypeOf<Return>().not.toEqualTypeOf<never>();
});

test("InferUseHookFormActionHookReturn has correct action result types", () => {
	const schema = z.object({ email: z.string() });
	type ActionFn = SafeActionFn<string, typeof schema, [], ValidationErrors<typeof schema>, { userId: string }>;
	type Return = InferUseHookFormActionHookReturn<ActionFn>;

	expectTypeOf<Return["action"]["result"]["data"]>().toEqualTypeOf<{ userId: string } | undefined>();
	expectTypeOf<Return["action"]["result"]["serverError"]>().toEqualTypeOf<string | undefined>();
	expectTypeOf<Return["action"]["status"]>().toEqualTypeOf<HookActionStatus>();
});

test("InferUseHookFormActionHookReturn has form, handlers", () => {
	const schema = z.object({ name: z.string() });
	type ActionFn = SafeActionFn<string, typeof schema, [], ValidationErrors<typeof schema>, void>;
	type Return = InferUseHookFormActionHookReturn<ActionFn>;

	expectTypeOf<Return["form"]>().not.toBeAny();
	expectTypeOf<Return["handleSubmitWithAction"]>().not.toBeAny();
	expectTypeOf<Return["resetFormAndAction"]>().toEqualTypeOf<() => void>();
});

test("InferUseHookFormActionHookReturn with custom server error", () => {
	type CustomError = { code: number; detail: string };
	type ActionFn = SafeActionFn<CustomError, undefined, [], undefined, { ok: boolean }>;
	type Return = InferUseHookFormActionHookReturn<ActionFn>;

	expectTypeOf<Return["action"]["result"]["serverError"]>().toEqualTypeOf<CustomError | undefined>();
	expectTypeOf<Return["action"]["result"]["data"]>().toEqualTypeOf<{ ok: boolean } | undefined>();
});

test("InferUseHookFormActionHookReturn with custom FormContext", () => {
	type ActionFn = SafeActionFn<string, undefined, [], undefined, void>;
	type Return = InferUseHookFormActionHookReturn<ActionFn, { custom: true }>;

	expectTypeOf<Return>().not.toBeAny();
	expectTypeOf<Return>().not.toEqualTypeOf<never>();
});

test("InferUseHookFormActionHookReturn returns never for non-action types", () => {
	type Result = InferUseHookFormActionHookReturn<() => void>;
	expectTypeOf<Result>().toEqualTypeOf<never>();
});

// ─── InferUseHookFormOptimisticActionHookReturn ───────────────────────

test("InferUseHookFormOptimisticActionHookReturn extracts return type with state", () => {
	const schema = z.object({ name: z.string() });
	type ActionFn = SafeActionFn<string, typeof schema, [], ValidationErrors<typeof schema>, { id: string }>;
	type Return = InferUseHookFormOptimisticActionHookReturn<ActionFn, { items: string[] }>;

	expectTypeOf<Return>().not.toBeAny();
	expectTypeOf<Return>().not.toEqualTypeOf<never>();
});

test("InferUseHookFormOptimisticActionHookReturn.action has optimisticState", () => {
	type ActionFn = SafeActionFn<string, undefined, [], undefined, void>;
	type Return = InferUseHookFormOptimisticActionHookReturn<ActionFn, { count: number }>;

	expectTypeOf<Return["action"]["optimisticState"]>().toEqualTypeOf<{ count: number }>();
});

test("InferUseHookFormOptimisticActionHookReturn has form and handlers", () => {
	type ActionFn = SafeActionFn<string, undefined, [], undefined, void>;
	type Return = InferUseHookFormOptimisticActionHookReturn<ActionFn, { count: number }>;

	expectTypeOf<Return["form"]>().not.toBeAny();
	expectTypeOf<Return["handleSubmitWithAction"]>().not.toBeAny();
	expectTypeOf<Return["resetFormAndAction"]>().toEqualTypeOf<() => void>();
});

test("InferUseHookFormOptimisticActionHookReturn with custom server error and data", () => {
	type CustomError = { message: string };
	const schema = z.object({ title: z.string() });
	type ActionFn = SafeActionFn<CustomError, typeof schema, [], ValidationErrors<typeof schema>, { saved: boolean }>;
	type Return = InferUseHookFormOptimisticActionHookReturn<ActionFn, { draft: string }>;

	expectTypeOf<Return["action"]["result"]["serverError"]>().toEqualTypeOf<CustomError | undefined>();
	expectTypeOf<Return["action"]["result"]["data"]>().toEqualTypeOf<{ saved: boolean } | undefined>();
	expectTypeOf<Return["action"]["optimisticState"]>().toEqualTypeOf<{ draft: string }>();
});

test("InferUseHookFormOptimisticActionHookReturn returns never for non-action types", () => {
	type Result = InferUseHookFormOptimisticActionHookReturn<() => void, any>;
	expectTypeOf<Result>().toEqualTypeOf<never>();
});

test("InferUseHookFormOptimisticActionHookReturn with custom FormContext", () => {
	type ActionFn = SafeActionFn<string, undefined, [], undefined, void>;
	type Return = InferUseHookFormOptimisticActionHookReturn<ActionFn, { count: number }, { ctx: boolean }>;

	expectTypeOf<Return>().not.toBeAny();
	expectTypeOf<Return>().not.toEqualTypeOf<never>();
});
