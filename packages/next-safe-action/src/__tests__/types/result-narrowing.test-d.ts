// Verifies that `SafeActionResult` narrows correctly across its four branches
// (idle, success, server error, validation error). These tests pin down the
// contract users depend on when destructuring an action result and checking
// one field to know the state of the others.

import { expectTypeOf, test } from "vitest";
import { z } from "zod";
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
