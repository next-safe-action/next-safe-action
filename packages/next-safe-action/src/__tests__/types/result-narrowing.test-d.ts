// Verifies that `SafeActionResult` narrows correctly across its four branches
// (idle, success, server error, validation error). These tests pin down the
// contract users depend on when destructuring an action result and checking
// one field to know the state of the others.

import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import { createSafeActionClient } from "../..";
import type { ActionCallbacks, InferSafeActionFnResult, SafeActionFn, SafeActionResult } from "../../index.types";
import type { ValidationErrors } from "../../validation-errors.types";

const schema = z.object({ name: z.string().min(1) });

type Data = { id: string };
type ServerError = string;
type Shape = ValidationErrors<typeof schema>;
type Result = SafeActionResult<ServerError, typeof schema, Shape, Data>;

// ─── Direct access narrowing ────────────────────────────────────────────────

test("unguarded read preserves X | undefined for each field", () => {
	const r = {} as Result;
	expectTypeOf(r.data).toEqualTypeOf<Data | undefined>();
	expectTypeOf(r.serverError).toEqualTypeOf<ServerError | undefined>();
	expectTypeOf(r.validationErrors).toEqualTypeOf<Shape | undefined>();
});

test("if (result.data) narrows sibling fields to undefined", () => {
	const r = {} as Result;
	if (r.data) {
		expectTypeOf(r.data).toEqualTypeOf<Data>();
		expectTypeOf(r.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(r.validationErrors).toEqualTypeOf<undefined>();
	}
});

test("if (result.serverError) narrows siblings to undefined", () => {
	const r = {} as Result;
	if (r.serverError) {
		expectTypeOf(r.data).toEqualTypeOf<undefined>();
		expectTypeOf(r.serverError).toEqualTypeOf<ServerError>();
		expectTypeOf(r.validationErrors).toEqualTypeOf<undefined>();
	}
});

test("if (result.validationErrors) narrows siblings to undefined", () => {
	const r = {} as Result;
	if (r.validationErrors) {
		expectTypeOf(r.data).toEqualTypeOf<undefined>();
		expectTypeOf(r.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(r.validationErrors).toEqualTypeOf<Shape>();
	}
});

// ─── Destructured narrowing (the primary user DX case) ─────────────────────

test("destructured fields narrow together on if (data)", () => {
	const { data, serverError, validationErrors } = {} as Result;

	if (data) {
		expectTypeOf(data).toEqualTypeOf<Data>();
		expectTypeOf(serverError).toEqualTypeOf<undefined>();
		expectTypeOf(validationErrors).toEqualTypeOf<undefined>();
	}
});

test("destructured fields narrow together on if (serverError)", () => {
	const { data, serverError, validationErrors } = {} as Result;

	if (serverError) {
		expectTypeOf(data).toEqualTypeOf<undefined>();
		expectTypeOf(serverError).toEqualTypeOf<ServerError>();
		expectTypeOf(validationErrors).toEqualTypeOf<undefined>();
	}
});

test("destructured fields narrow together on if (validationErrors)", () => {
	const { data, serverError, validationErrors } = {} as Result;

	if (validationErrors) {
		expectTypeOf(data).toEqualTypeOf<undefined>();
		expectTypeOf(serverError).toEqualTypeOf<undefined>();
		expectTypeOf(validationErrors).toEqualTypeOf<Shape>();
	}
});

// ─── Idle branch and fresh-object assignability ────────────────────────────

test("empty object assigns to Result (idle branch)", () => {
	// The successful compilation IS the assertion — `{}` must be assignable
	// to Result so that `useAction`'s `useState<Result>({})` initializer works.
	const _idle: Result = {};
	void _idle;
});

test("fresh object literals assign for each branch", () => {
	// Each line's successful compilation is the test. If any assignment
	// stopped matching a branch of the discriminated union, TypeScript would
	// reject it here.
	const _idle: Result = {};
	const _success: Result = { data: { id: "x" } };
	const _serverErr: Result = { serverError: "oops" };
	const _validationErr: Result = { validationErrors: { name: { _errors: ["required"] } } as Shape };
	void _idle;
	void _success;
	void _serverErr;
	void _validationErr;
});

// ─── Negative tests: compound literals must not assign ─────────────────────
//
// These tests pin the mutual exclusivity contract. Without them, a regression
// that widens `SafeActionResult` back into a flat object (where all three fields
// are independently optional) would silently re-admit compound literals —
// defeating the narrowing guarantee users depend on.

test("compound {data, serverError} literal is rejected", () => {
	// @ts-expect-error — success and server error branches are mutually exclusive
	const _bad: Result = { data: { id: "x" }, serverError: "oops" };
	void _bad;
});

test("compound {data, validationErrors} literal is rejected", () => {
	// @ts-expect-error — success and validation error branches are mutually exclusive
	const _bad: Result = { data: { id: "x" }, validationErrors: { name: { _errors: ["required"] } } as Shape };
	void _bad;
});

test("compound {serverError, validationErrors} literal is rejected", () => {
	// @ts-expect-error — server error and validation error branches are mutually exclusive
	const _bad: Result = { serverError: "oops", validationErrors: { name: { _errors: ["required"] } } as Shape };
	void _bad;
});

test("all-three-fields literal is rejected", () => {
	// @ts-expect-error — no branch of the union accepts all three fields populated
	const _bad: Result = {
		data: { id: "x" },
		serverError: "oops",
		validationErrors: { name: { _errors: ["required"] } } as Shape,
	};
	void _bad;
});

// ─── onError callback receives the full union (no cast needed) ─────────────

test("onError callback's error parameter accepts the full result union", () => {
	type CB = NonNullable<ActionCallbacks<ServerError, undefined, object, typeof schema, [], Shape, Data>["onError"]>;

	type ErrorArg = Parameters<CB>[0]["error"];

	// The onError callback omits `data` from the result type. Under the new
	// discriminated union, `Omit<Result, "data">` distributes over the union
	// and still narrows on truthy error fields.
	const err = {} as ErrorArg;
	if (err.serverError) {
		expectTypeOf(err.serverError).toEqualTypeOf<ServerError>();
	}
	if (err.validationErrors) {
		expectTypeOf(err.validationErrors).toEqualTypeOf<Shape>();
	}
});

// ─── onSettled callback receives the full result union ─────────────────────

test("onSettled callback's result parameter narrows on truthy data", () => {
	type CB = NonNullable<ActionCallbacks<ServerError, undefined, object, typeof schema, [], Shape, Data>["onSettled"]>;
	type ResultArg = Parameters<CB>[0]["result"];

	// `onSettled` fires after every outcome, so it receives the raw
	// `SafeActionResult` union. Narrowing must still propagate through
	// `Prettify<...>` to the callback consumer.
	const settled = {} as ResultArg;
	if (settled.data) {
		expectTypeOf(settled.data).toEqualTypeOf<Data>();
		expectTypeOf(settled.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(settled.validationErrors).toEqualTypeOf<undefined>();
	}
});

test("onSettled callback's result parameter narrows on truthy serverError", () => {
	type CB = NonNullable<ActionCallbacks<ServerError, undefined, object, typeof schema, [], Shape, Data>["onSettled"]>;
	type ResultArg = Parameters<CB>[0]["result"];

	const settled = {} as ResultArg;
	if (settled.serverError) {
		expectTypeOf(settled.serverError).toEqualTypeOf<ServerError>();
		expectTypeOf(settled.data).toEqualTypeOf<undefined>();
		expectTypeOf(settled.validationErrors).toEqualTypeOf<undefined>();
	}
});

test("onSettled callback's result parameter narrows on truthy validationErrors", () => {
	type CB = NonNullable<ActionCallbacks<ServerError, undefined, object, typeof schema, [], Shape, Data>["onSettled"]>;
	type ResultArg = Parameters<CB>[0]["result"];

	const settled = {} as ResultArg;
	if (settled.validationErrors) {
		expectTypeOf(settled.validationErrors).toEqualTypeOf<Shape>();
		expectTypeOf(settled.data).toEqualTypeOf<undefined>();
		expectTypeOf(settled.serverError).toEqualTypeOf<undefined>();
	}
});

// ─── Generic inference via InferSafeActionFnResult ─────────────────────────

test("InferSafeActionFnResult preserves narrowing on extracted result", () => {
	type Fn = SafeActionFn<ServerError, typeof schema, [], Shape, Data>;
	type R = InferSafeActionFnResult<Fn>;

	const r = {} as R;
	if (r.data) {
		expectTypeOf(r.data).toEqualTypeOf<Data>();
		expectTypeOf(r.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(r.validationErrors).toEqualTypeOf<undefined>();
	}
});

// ─── Real-world usage shape ────────────────────────────────────────────────

test("the canonical user DX case: await action() destructured + narrowed", async () => {
	// Build a realistic action function signature.
	type Fn = SafeActionFn<string, typeof schema, [], Shape, Data>;
	const action = (async () => ({}) as Result) as unknown as Fn;

	const { data, serverError, validationErrors } = await action({ name: "x" });

	if (data) {
		expectTypeOf(data).toEqualTypeOf<Data>();
		expectTypeOf(serverError).toEqualTypeOf<undefined>();
		expectTypeOf(validationErrors).toEqualTypeOf<undefined>();
	} else if (serverError) {
		expectTypeOf(data).toEqualTypeOf<undefined>();
		expectTypeOf(serverError).toEqualTypeOf<string>();
		expectTypeOf(validationErrors).toEqualTypeOf<undefined>();
	} else if (validationErrors) {
		expectTypeOf(data).toEqualTypeOf<undefined>();
		expectTypeOf(serverError).toEqualTypeOf<undefined>();
		expectTypeOf(validationErrors).toEqualTypeOf<Shape>();
	}
});

// ─── Void-returning actions ───────────────────────────────────────────────
//
// When `Data = void`, the runtime never emits `{ data: undefined }` separately
// from the idle `{}` — see `buildResultAndRunCallbacks` in action-builder.ts,
// which only sets `data` when `middlewareResult.data !== undefined`.
//
// `NormalizeActionResult` is NOT applied at the `SafeActionFn` return level
// because doing so would cause TypeScript to eagerly expand the discriminated
// union during `.bind()`, breaking generic inference for hooks. Instead,
// normalization is applied at the hook boundary (e.g. `UseActionHookReturn`),
// where users see `data: undefined` for void actions. At the direct `await`
// level, `data` is `void | undefined`.

// Use a schema so ShapedErrors is a real type (not `undefined`), which keeps
// the error branches distinguishable for narrowing tests.
type VoidFn = SafeActionFn<string, typeof schema, [], Shape, void>;
type VoidResult = InferSafeActionFnResult<VoidFn>;

test("void-returning action: r.data is `void | undefined` at direct await level", () => {
	const r = {} as VoidResult;
	expectTypeOf<typeof r.data>().toEqualTypeOf<void | undefined>();
});

test("void-returning action: error branches still narrow and leave data as undefined", () => {
	const r = {} as VoidResult;
	if (r.serverError) {
		expectTypeOf(r.serverError).toEqualTypeOf<string>();
		expectTypeOf(r.data).toEqualTypeOf<undefined>();
		expectTypeOf(r.validationErrors).toEqualTypeOf<undefined>();
	}
	if (r.validationErrors) {
		expectTypeOf(r.validationErrors).toEqualTypeOf<Shape>();
		expectTypeOf(r.data).toEqualTypeOf<undefined>();
		expectTypeOf(r.serverError).toEqualTypeOf<undefined>();
	}
});

test("void-returning action: runtime `{}` still assigns to the result type", () => {
	// The successful compilation IS the assertion — the runtime idle/success
	// shape must remain compatible with the type.
	const _idle: VoidResult = {};
	void _idle;
});

test("void-returning action inferred from serverCodeFn has r.data = void | undefined", async () => {
	// End-to-end: define an action that returns nothing and verify the
	// awaited result's `data` field type at the direct await level.
	const ac = createSafeActionClient();
	const action = ac.action(async () => {
		return;
	});

	const r = await action();
	expectTypeOf<typeof r.data>().toEqualTypeOf<void | undefined>();
});

test("data-returning action still narrows unchanged (regression guard)", async () => {
	const ac = createSafeActionClient();
	const action = ac.action(async () => {
		return { id: "abc" };
	});

	const r = await action();
	expectTypeOf<typeof r.data>().toEqualTypeOf<{ id: string } | undefined>();
	if (r.data) {
		expectTypeOf(r.data).toEqualTypeOf<{ id: string }>();
	}
});

test("default SafeActionResult (Data=unknown) keeps the success branch", () => {
	// If `Data` is the default `unknown`, the success branch must NOT collapse.
	// `r.data` stays reachable as `unknown` rather than being forced to `undefined`.
	type R = SafeActionResult<string, typeof schema>;
	const r = {} as R;
	// Before any narrowing, r.data unions the success branch's `unknown` with the
	// other branches' `undefined`, which simplifies to `unknown`.
	expectTypeOf<typeof r.data>().toEqualTypeOf<unknown>();
	// A fresh object with an arbitrary `data` value must still be assignable
	// through the success branch — this fails if the success branch has been
	// incorrectly collapsed for non-void Data.
	const _success: R = { data: { anything: true } };
	void _success;
});
