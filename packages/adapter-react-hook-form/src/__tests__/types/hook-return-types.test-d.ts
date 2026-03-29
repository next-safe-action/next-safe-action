import type { ValidationErrors } from "next-safe-action";
import type { HookActionStatus } from "next-safe-action/hooks";
import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import type { UseHookFormActionHookReturn, UseHookFormOptimisticActionHookReturn, HookProps } from "../../hooks.types";

// ─── UseHookFormActionHookReturn ─────────────────────────────────────

test("UseHookFormActionHookReturn has action, form, handleSubmitWithAction, resetFormAndAction", () => {
	const schema = z.object({ name: z.string() });
	type Return = UseHookFormActionHookReturn<string, typeof schema, ValidationErrors<typeof schema>, { id: string }>;

	expectTypeOf<Return["action"]>().not.toBeAny();
	expectTypeOf<Return["form"]>().not.toBeAny();
	expectTypeOf<Return["handleSubmitWithAction"]>().not.toBeAny();
	expectTypeOf<Return["resetFormAndAction"]>().toEqualTypeOf<() => void>();
});

test("UseHookFormActionHookReturn.action is UseActionHookReturn", () => {
	const schema = z.object({ name: z.string() });
	type Return = UseHookFormActionHookReturn<string, typeof schema, ValidationErrors<typeof schema>, { id: string }>;

	// action has the core hook return properties
	expectTypeOf<Return["action"]["status"]>().toEqualTypeOf<HookActionStatus>();
	expectTypeOf<Return["action"]["result"]["data"]>().toEqualTypeOf<{ id: string } | undefined>();
	expectTypeOf<Return["action"]["result"]["serverError"]>().toEqualTypeOf<string | undefined>();
	expectTypeOf<Return["action"]["reset"]>().toEqualTypeOf<() => void>();
});

test("UseHookFormActionHookReturn.action has shorthand status booleans", () => {
	type Return = UseHookFormActionHookReturn<string, undefined, undefined, void>;

	expectTypeOf<Return["action"]["isIdle"]>().toEqualTypeOf<boolean>();
	expectTypeOf<Return["action"]["isExecuting"]>().toEqualTypeOf<boolean>();
	expectTypeOf<Return["action"]["isPending"]>().toEqualTypeOf<boolean>();
	expectTypeOf<Return["action"]["hasSucceeded"]>().toEqualTypeOf<boolean>();
	expectTypeOf<Return["action"]["hasErrored"]>().toEqualTypeOf<boolean>();
});

test("UseHookFormActionHookReturn.form is UseFormReturn with schema types", () => {
	const schema = z.object({ name: z.string(), age: z.number() });
	type Return = UseHookFormActionHookReturn<string, typeof schema, ValidationErrors<typeof schema>, void>;

	// form should be a UseFormReturn parameterized with the schema input/output types
	expectTypeOf<Return["form"]>().not.toBeAny();
	expectTypeOf<Return["form"]["handleSubmit"]>().not.toBeAny();
	expectTypeOf<Return["form"]["reset"]>().not.toBeAny();
	expectTypeOf<Return["form"]["register"]>().not.toBeAny();
});

test("UseHookFormActionHookReturn.handleSubmitWithAction accepts optional event", () => {
	type Return = UseHookFormActionHookReturn<string, undefined, undefined, void>;

	// handleSubmitWithAction takes an optional BaseSyntheticEvent and returns Promise<void>
	type HandleSubmit = Return["handleSubmitWithAction"];
	expectTypeOf<HandleSubmit>().not.toBeAny();
	expectTypeOf<ReturnType<HandleSubmit>>().toEqualTypeOf<Promise<void>>();
});

// ─── UseHookFormOptimisticActionHookReturn ────────────────────────────

test("UseHookFormOptimisticActionHookReturn.action includes optimisticState", () => {
	type Return = UseHookFormOptimisticActionHookReturn<string, undefined, undefined, void, { count: number }>;

	expectTypeOf<Return["action"]["optimisticState"]>().toEqualTypeOf<{ count: number }>();
});

test("UseHookFormOptimisticActionHookReturn still has form and handlers", () => {
	type Return = UseHookFormOptimisticActionHookReturn<string, undefined, undefined, void, { count: number }>;

	expectTypeOf<Return["form"]>().not.toBeAny();
	expectTypeOf<Return["handleSubmitWithAction"]>().not.toBeAny();
	expectTypeOf<Return["resetFormAndAction"]>().toEqualTypeOf<() => void>();
});

test("UseHookFormOptimisticActionHookReturn.action has shorthand status", () => {
	type Return = UseHookFormOptimisticActionHookReturn<string, undefined, undefined, void, { count: number }>;

	expectTypeOf<Return["action"]["isIdle"]>().toEqualTypeOf<boolean>();
	expectTypeOf<Return["action"]["isExecuting"]>().toEqualTypeOf<boolean>();
	expectTypeOf<Return["action"]["hasSucceeded"]>().toEqualTypeOf<boolean>();
});

// ─── HookProps ───────────────────────────────────────────────────────

test("HookProps has errorMapProps, actionProps, formProps", () => {
	const schema = z.object({ name: z.string() });
	type Props = HookProps<string, typeof schema, ValidationErrors<typeof schema>, { id: string }>;

	expectTypeOf<Props["errorMapProps"]>().toEqualTypeOf<{ joinBy?: string } | undefined>();
	expectTypeOf<Props["actionProps"]>().not.toBeAny();
	expectTypeOf<Props["formProps"]>().not.toBeAny();
});

test("HookProps.formProps excludes resolver", () => {
	type Props = HookProps<string, undefined, undefined, void>;

	// formProps should not include 'resolver' key
	type FormPropsKeys = keyof NonNullable<Props["formProps"]>;
	type HasResolver = "resolver" extends FormPropsKeys ? true : false;
	expectTypeOf<HasResolver>().toEqualTypeOf<false>();
});

test("HookProps FormContext defaults to any", () => {
	type PropsDefault = HookProps<string, undefined, undefined, void>;
	type PropsCustom = HookProps<string, undefined, undefined, void, { custom: true }>;

	// Both should be valid types
	expectTypeOf<PropsDefault>().not.toBeAny();
	expectTypeOf<PropsCustom>().not.toBeAny();
});

// ─── Custom server error flows through ───────────────────────────────

test("custom server error type flows through to action result", () => {
	type CustomError = { code: number; message: string };
	type Return = UseHookFormActionHookReturn<CustomError, undefined, undefined, void>;

	expectTypeOf<Return["action"]["result"]["serverError"]>().toEqualTypeOf<CustomError | undefined>();
});
