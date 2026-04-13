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
	HookCallbacks,
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

// ─── Hook callback narrowing ────────────────────────────────────────────────
//
// `useAction`, `useOptimisticAction`, and `useStateAction` all forward lifecycle
// callbacks (`onSuccess`, `onError`, `onSettled`, `onNavigation`) from the
// `HookCallbacks` type defined in `hooks.types.ts`. These tests pin the
// discriminated-union narrowing and auxiliary fields on those callback args,
// because the hook layer adds `thrownError` to `onError` that the server-side
// `ActionCallbacks` does not expose.

test("onSettled hook callback's result parameter narrows on truthy data", () => {
	type CB = NonNullable<HookCallbacks<ServerError, typeof schema, Shape, Data>["onSettled"]>;
	type ResultArg = Parameters<CB>[0]["result"];

	const settled = {} as ResultArg;
	if (settled.data) {
		expectTypeOf(settled.data).toEqualTypeOf<Data>();
		expectTypeOf(settled.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(settled.validationErrors).toEqualTypeOf<undefined>();
	}
});

test("onSettled hook callback's result parameter narrows on truthy serverError", () => {
	type CB = NonNullable<HookCallbacks<ServerError, typeof schema, Shape, Data>["onSettled"]>;
	type ResultArg = Parameters<CB>[0]["result"];

	const settled = {} as ResultArg;
	if (settled.serverError) {
		expectTypeOf(settled.serverError).toEqualTypeOf<ServerError>();
		expectTypeOf(settled.data).toEqualTypeOf<undefined>();
		expectTypeOf(settled.validationErrors).toEqualTypeOf<undefined>();
	}
});

test("onSettled hook callback's result parameter narrows on truthy validationErrors", () => {
	type CB = NonNullable<HookCallbacks<ServerError, typeof schema, Shape, Data>["onSettled"]>;
	type ResultArg = Parameters<CB>[0]["result"];

	const settled = {} as ResultArg;
	if (settled.validationErrors) {
		expectTypeOf(settled.validationErrors).toEqualTypeOf<Shape>();
		expectTypeOf(settled.data).toEqualTypeOf<undefined>();
		expectTypeOf(settled.serverError).toEqualTypeOf<undefined>();
	}
});

test("onSettled hook callback receives optional navigationKind", () => {
	type CB = NonNullable<HookCallbacks<ServerError, typeof schema, Shape, Data>["onSettled"]>;
	type NavArg = Parameters<CB>[0]["navigationKind"];
	// `navigationKind` is optional because non-navigation outcomes omit it.
	// The "other" member is emitted by `FrameworkErrorHandler.getNavigationKind`
	// as a fallback for unrecognized digests, so it must stay in the union.
	expectTypeOf<NavArg>().toEqualTypeOf<
		"redirect" | "notFound" | "forbidden" | "unauthorized" | "other" | undefined
	>();
});

test("onError hook callback's error parameter exposes thrownError: Error | undefined", () => {
	// The hook-level `onError` intersects the server error result with
	// `{ thrownError?: Error }` so hook consumers can surface exceptions that
	// never became a typed `serverError` (e.g. render-phase throws, mid-transition
	// failures). The field is optional — present only when an exception was caught.
	type CB = NonNullable<HookCallbacks<ServerError, typeof schema, Shape, Data>["onError"]>;
	type ErrorArg = Parameters<CB>[0]["error"];

	expectTypeOf<ErrorArg["thrownError"]>().toEqualTypeOf<Error | undefined>();
});

test("onError hook callback's error parameter still narrows on serverError/validationErrors", () => {
	// Intersecting `{ thrownError?: Error }` with the discriminated union must
	// NOT collapse the narrowing behavior of the underlying branches.
	//
	// Note: the sibling-to-`undefined` narrowing (proven for `ActionCallbacks`
	// in `result-narrowing.test-d.ts`) does NOT carry through cleanly after the
	// `Prettify` + intersection, so here we only assert positive narrowing on
	// the checked field. That matches how consumers actually use `onError`.
	type CB = NonNullable<HookCallbacks<ServerError, typeof schema, Shape, Data>["onError"]>;
	type ErrorArg = Parameters<CB>[0]["error"];

	const err = {} as ErrorArg;
	if (err.serverError) {
		expectTypeOf(err.serverError).toEqualTypeOf<ServerError>();
	}
	if (err.validationErrors) {
		expectTypeOf(err.validationErrors).toEqualTypeOf<Shape>();
	}
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

test("UseStateActionHookReturn idle branch is narrowed by InitR generic", () => {
	type SeededInit = { data: { id: number }; serverError?: undefined; validationErrors?: undefined };
	type Return = UseStateActionHookReturn<
		string,
		typeof schema,
		ValidationErrors<typeof schema>,
		{ id: number },
		SeededInit
	>;
	const ret = {} as Return;

	if (ret.status === "idle") {
		// Idle branch's result is narrowed to the seeded shape, not the empty HookIdleResult
		expectTypeOf(ret.result.data).toEqualTypeOf<{ id: number }>();
	}
});

test("UseStateActionHookReturn idle branch preserves all idle keys when InitR is a partial seed", () => {
	// InitR inferred from a literal omits serverError/validationErrors keys; the public idle
	// type must still expose them as `undefined` so destructuring code stays sound.
	type SeededInit = { data: { id: number } };
	type Return = UseStateActionHookReturn<
		string,
		typeof schema,
		ValidationErrors<typeof schema>,
		{ id: number },
		SeededInit
	>;
	const ret = {} as Return;

	if (ret.status === "idle") {
		expectTypeOf(ret.result.data).toEqualTypeOf<{ id: number }>();
		expectTypeOf(ret.result.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(ret.result.validationErrors).toEqualTypeOf<undefined>();
	}
});

test("UseStateActionHookReturn idle branch defaults to HookIdleResult when InitR is omitted", () => {
	type Return = UseStateActionHookReturn<string, typeof schema, ValidationErrors<typeof schema>, { id: number }>;
	const ret = {} as Return;

	if (ret.status === "idle") {
		expectTypeOf(ret.result.data).toEqualTypeOf<undefined>();
		expectTypeOf(ret.result.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(ret.result.validationErrors).toEqualTypeOf<undefined>();
	}
});

test("UseStateActionHookReturn idle branch narrowed by serverError-only InitR", () => {
	// Users sometimes seed `initResult` with a fresh-state server error (e.g. from
	// a server component that already failed) and rely on the idle result exposing
	// that error literally rather than `string | undefined`.
	type SeededInit = { serverError: "seeded" };
	type Return = UseStateActionHookReturn<
		string,
		typeof schema,
		ValidationErrors<typeof schema>,
		{ id: number },
		SeededInit
	>;
	const ret = {} as Return;

	if (ret.status === "idle") {
		expectTypeOf(ret.result.serverError).toEqualTypeOf<"seeded">();
		expectTypeOf(ret.result.data).toEqualTypeOf<undefined>();
		expectTypeOf(ret.result.validationErrors).toEqualTypeOf<undefined>();
	}
});

test("UseStateActionHookReturn idle branch narrowed by validationErrors-only InitR", () => {
	type SeededShape = { name: { _errors: string[] } };
	type SeededInit = { validationErrors: SeededShape };
	type Return = UseStateActionHookReturn<
		string,
		typeof schema,
		ValidationErrors<typeof schema>,
		{ id: number },
		SeededInit
	>;
	const ret = {} as Return;

	if (ret.status === "idle") {
		expectTypeOf(ret.result.validationErrors).toEqualTypeOf<SeededShape>();
		expectTypeOf(ret.result.data).toEqualTypeOf<undefined>();
		expectTypeOf(ret.result.serverError).toEqualTypeOf<undefined>();
	}
});

test("UseStateActionHookReturn idle branch passes-through non-idle branches when InitR is set", () => {
	// Non-idle branches are unaffected by InitR. If the action succeeds after the
	// seeded idle result, the success branch's `result.data` is the real Data
	// type, not the seed.
	type SeededInit = { data: { id: 42 } };
	type Return = UseStateActionHookReturn<
		string,
		typeof schema,
		ValidationErrors<typeof schema>,
		{ id: number },
		SeededInit
	>;
	const ret = {} as Return;

	if (ret.status === "hasSucceeded") {
		expectTypeOf(ret.result.data).toEqualTypeOf<{ id: number }>();
	}
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

// ─── Infer*HookReturn preserves discriminated union narrowing ───────────────
//
// The `Infer*` utilities are a public API surface (exported from `hooks.types`).
// Consumers rely on them producing a usable discriminated union — not just a
// flat bag where `result.data` happens to have the right leaf type. These tests
// pin the narrowing behavior on inferred returns, catching any regression that
// collapses the union during inference.

test("InferUseActionHookReturn preserves narrowing on hasSucceeded", () => {
	type ActionFn = SafeActionFn<string, typeof schema, [], Shape, { id: string }>;
	type Return = InferUseActionHookReturn<ActionFn>;
	const ret = {} as Return;

	if (ret.hasSucceeded) {
		expectTypeOf(ret.result.data).toEqualTypeOf<{ id: string }>();
		expectTypeOf(ret.result.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(ret.result.validationErrors).toEqualTypeOf<undefined>();
	}
});

test("InferUseOptimisticActionHookReturn preserves narrowing on hasSucceeded", () => {
	type ActionFn = SafeActionFn<string, typeof schema, [], Shape, { id: string }>;
	type Return = InferUseOptimisticActionHookReturn<ActionFn, { count: number }>;
	const ret = {} as Return;

	if (ret.hasSucceeded) {
		expectTypeOf(ret.result.data).toEqualTypeOf<{ id: string }>();
		expectTypeOf(ret.optimisticState).toEqualTypeOf<{ count: number }>();
		expectTypeOf(ret.status).toEqualTypeOf<"hasSucceeded">();
	}
});

test("InferUseStateActionHookReturn preserves narrowing on hasSucceeded", () => {
	type StateActionFn = SafeStateActionFn<string, typeof schema, [], Shape, { id: string }>;
	type Return = InferUseStateActionHookReturn<StateActionFn>;
	const ret = {} as Return;

	if (ret.hasSucceeded) {
		expectTypeOf(ret.result.data).toEqualTypeOf<{ id: string }>();
		expectTypeOf(ret.result.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(ret.status).toEqualTypeOf<"hasSucceeded">();
	}
});

test("InferUseActionHookReturn preserves narrowing on hasErrored status", () => {
	type ActionFn = SafeActionFn<string, typeof schema, [], Shape, { id: string }>;
	type Return = InferUseActionHookReturn<ActionFn>;
	const ret = {} as Return;

	if (ret.status === "hasErrored" && ret.result.serverError) {
		expectTypeOf(ret.result.serverError).toEqualTypeOf<string>();
		expectTypeOf(ret.result.data).toEqualTypeOf<undefined>();
	}
});

// ─── Destructured narrowing on state and optimistic hook returns ────────────
//
// TypeScript 4.6+ narrows destructured fields of a discriminated union. The
// base test at `UseActionHookReturn` already pins this behavior, but the state
// and optimistic hook types are built via different type constructions
// (intersection + Omit over a mapped conditional for state, plain intersection
// for optimistic). A regression in either construction would break destructured
// narrowing without breaking the base test — worth a separate assertion.

test("destructuring UseStateActionHookReturn narrows on status", () => {
	const { status, result } = {} as UseStateActionHookReturn<ServerError, typeof schema, Shape, Data>;

	if (status === "hasSucceeded") {
		expectTypeOf(result.data).toEqualTypeOf<Data>();
		expectTypeOf(result.serverError).toEqualTypeOf<undefined>();
	}
});

test("destructuring UseStateActionHookReturn narrows on hasErrored shorthand", () => {
	const { hasErrored, result } = {} as UseStateActionHookReturn<ServerError, typeof schema, Shape, Data>;

	if (hasErrored) {
		expectTypeOf(result.data).toEqualTypeOf<undefined>();
	}
});

test("destructuring UseOptimisticActionHookReturn narrows on status", () => {
	const { status, result, optimisticState } = {} as UseOptimisticActionHookReturn<
		ServerError,
		typeof schema,
		Shape,
		Data,
		{ count: number }
	>;

	if (status === "hasSucceeded") {
		expectTypeOf(result.data).toEqualTypeOf<Data>();
		expectTypeOf(optimisticState).toEqualTypeOf<{ count: number }>();
	}
});

test("destructuring UseOptimisticActionHookReturn narrows on hasSucceeded shorthand", () => {
	const { hasSucceeded, result } = {} as UseOptimisticActionHookReturn<
		ServerError,
		typeof schema,
		Shape,
		Data,
		{ count: number }
	>;

	if (hasSucceeded) {
		expectTypeOf(result.data).toEqualTypeOf<Data>();
	}
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
