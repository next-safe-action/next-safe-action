import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import type {
	InferInputOrDefault,
	InferOutputOrDefault,
	InferInputArray,
	InferOutputArray,
	StandardSchemaV1,
} from "../../standard-schema";

test("InferInputOrDefault with schema returns schema input type", () => {
	const schema = z.object({ name: z.string() });
	type Result = InferInputOrDefault<typeof schema, void>;
	expectTypeOf<Result>().toEqualTypeOf<{ name: string }>();
});

test("InferInputOrDefault without schema returns default", () => {
	type Result = InferInputOrDefault<undefined, void>;
	expectTypeOf<Result>().toEqualTypeOf<void>();
});

test("InferOutputOrDefault with schema returns schema output type", () => {
	const schema = z.object({ count: z.number() });
	type Result = InferOutputOrDefault<typeof schema, void>;
	expectTypeOf<Result>().toEqualTypeOf<{ count: number }>();
});

test("InferOutputOrDefault without schema returns default", () => {
	type Result = InferOutputOrDefault<undefined, undefined>;
	expectTypeOf<Result>().toEqualTypeOf<undefined>();
});

test("InferInputOrDefault with transform uses input type", () => {
	const schema = z.object({ count: z.string().transform(Number) });
	type InputResult = InferInputOrDefault<typeof schema, void>;
	type OutputResult = InferOutputOrDefault<typeof schema, void>;
	// Input type is string (before transform)
	expectTypeOf<InputResult>().toEqualTypeOf<{ count: string }>();
	// Output type is number (after transform)
	expectTypeOf<OutputResult>().toEqualTypeOf<{ count: number }>();
});

test("InferInputArray preserves tuple types", () => {
	type Schemas = [z.ZodString, z.ZodNumber, z.ZodBoolean];
	type Result = InferInputArray<Schemas>;
	expectTypeOf<Result>().toEqualTypeOf<[string, number, boolean]>();
});

test("InferOutputArray preserves tuple types", () => {
	type Schemas = [z.ZodString, z.ZodNumber];
	type Result = InferOutputArray<Schemas>;
	expectTypeOf<Result>().toEqualTypeOf<[string, number]>();
});

test("InferInputArray with empty tuple", () => {
	type Result = InferInputArray<[]>;
	expectTypeOf<Result>().toEqualTypeOf<[]>();
});

test("InferOutputArray with empty tuple", () => {
	type Result = InferOutputArray<[]>;
	expectTypeOf<Result>().toEqualTypeOf<[]>();
});

test("StandardSchemaV1.InferInput extracts input type", () => {
	const schema = z.object({ name: z.string() });
	type Result = StandardSchemaV1.InferInput<typeof schema>;
	expectTypeOf<Result>().toEqualTypeOf<{ name: string }>();
});

test("StandardSchemaV1.InferOutput extracts output type", () => {
	const schema = z.object({ name: z.string() });
	type Result = StandardSchemaV1.InferOutput<typeof schema>;
	expectTypeOf<Result>().toEqualTypeOf<{ name: string }>();
});
