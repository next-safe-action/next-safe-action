import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import type {
	SafeActionFn,
	SafeStateActionFn,
	InferSafeActionFnInput,
	InferSafeActionFnResult,
	SafeActionResult,
} from "../../index.types";
import type { ValidationErrors } from "../../validation-errors.types";

test("InferSafeActionFnInput extracts input types from action function", () => {
	const schema = z.object({ name: z.string() });

	type ActionFn = SafeActionFn<string, typeof schema, [], ValidationErrors<typeof schema>, { id: string }>;
	type Inputs = InferSafeActionFnInput<ActionFn>;

	expectTypeOf<Inputs["clientInput"]>().toEqualTypeOf<{ name: string }>();
	expectTypeOf<Inputs["parsedInput"]>().toEqualTypeOf<{ name: string }>();
	expectTypeOf<Inputs["clientInput"]>().not.toBeAny();
});

test("InferSafeActionFnInput with undefined schema returns undefined inputs", () => {
	type ActionFn = SafeActionFn<string, undefined, [], undefined, { id: string }>;
	type Inputs = InferSafeActionFnInput<ActionFn>;

	expectTypeOf<Inputs["clientInput"]>().toEqualTypeOf<undefined>();
	expectTypeOf<Inputs["parsedInput"]>().toEqualTypeOf<undefined>();
});

test("InferSafeActionFnResult extracts result type from action function", () => {
	const schema = z.object({ name: z.string() });

	type ActionFn = SafeActionFn<string, typeof schema, [], ValidationErrors<typeof schema>, { id: string }>;
	type Result = InferSafeActionFnResult<ActionFn>;

	expectTypeOf<Result["data"]>().toEqualTypeOf<{ id: string } | undefined>();
	expectTypeOf<Result["serverError"]>().toEqualTypeOf<string | undefined>();
});

test("InferSafeActionFnResult works with SafeStateActionFn too", () => {
	const schema = z.object({ name: z.string() });

	type StateActionFn = SafeStateActionFn<string, typeof schema, [], ValidationErrors<typeof schema>, { id: string }>;
	type Result = InferSafeActionFnResult<StateActionFn>;

	expectTypeOf<Result["data"]>().toEqualTypeOf<{ id: string } | undefined>();
	expectTypeOf<Result["serverError"]>().toEqualTypeOf<string | undefined>();
});

test("custom server error type preserved in result", () => {
	type CustomError = { code: number; message: string };
	type ActionFn = SafeActionFn<CustomError, undefined, [], undefined, void>;
	type Result = InferSafeActionFnResult<ActionFn>;

	expectTypeOf<Result["serverError"]>().toEqualTypeOf<CustomError | undefined>();
});

test("InferSafeActionFnInput extracts bind args", () => {
	type ActionFn = SafeActionFn<
		string,
		z.ZodObject<{ name: z.ZodString }>,
		[z.ZodString, z.ZodNumber],
		ValidationErrors<z.ZodObject<{ name: z.ZodString }>>,
		void
	>;

	type Inputs = InferSafeActionFnInput<ActionFn>;

	expectTypeOf<Inputs["bindArgsClientInputs"][0]>().toEqualTypeOf<string>();
	expectTypeOf<Inputs["bindArgsClientInputs"][1]>().toEqualTypeOf<number>();
});

test("SafeActionResult has correct shape", () => {
	type Result = SafeActionResult<string, undefined, undefined, { ok: boolean }>;

	expectTypeOf<Result["data"]>().toEqualTypeOf<{ ok: boolean } | undefined>();
	expectTypeOf<Result["serverError"]>().toEqualTypeOf<string | undefined>();
	expectTypeOf<Result["validationErrors"]>().toEqualTypeOf<undefined>();
});

test("SafeActionResult narrows on truthy data", () => {
	const schema = z.object({ name: z.string() });
	type Result = SafeActionResult<string, typeof schema, ValidationErrors<typeof schema>, { id: string }>;
	const r = {} as Result;

	if (r.data) {
		expectTypeOf(r.data).toEqualTypeOf<{ id: string }>();
		expectTypeOf(r.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(r.validationErrors).toEqualTypeOf<undefined>();
	}
});

test("SafeActionResult narrows on truthy serverError", () => {
	const schema = z.object({ name: z.string() });
	type Result = SafeActionResult<string, typeof schema, ValidationErrors<typeof schema>, { id: string }>;
	const r = {} as Result;

	if (r.serverError) {
		expectTypeOf(r.data).toEqualTypeOf<undefined>();
		expectTypeOf(r.serverError).toEqualTypeOf<string>();
		expectTypeOf(r.validationErrors).toEqualTypeOf<undefined>();
	}
});

test("SafeActionResult narrows on truthy validationErrors", () => {
	const schema = z.object({ name: z.string() });
	type Result = SafeActionResult<string, typeof schema, ValidationErrors<typeof schema>, { id: string }>;
	const r = {} as Result;

	if (r.validationErrors) {
		expectTypeOf(r.data).toEqualTypeOf<undefined>();
		expectTypeOf(r.serverError).toEqualTypeOf<undefined>();
		expectTypeOf(r.validationErrors).toEqualTypeOf<ValidationErrors<typeof schema>>();
	}
});
