import type { UseMutationOptions } from "@tanstack/react-query";
import type { SingleInputActionFn } from "next-safe-action/hooks";
import { expectTypeOf, test } from "vitest";
import type { ActionMutationError } from "../../errors";
import { mutationOptions } from "../../index";
import type { InferActionMutationError, InferMutationOptions, MutationOptionsReturn } from "../../index.types";
import type { StandardSchemaV1 } from "../../standard-schema";

// Test schema types
type TestSchema = StandardSchemaV1<{ name: string }, { name: string }>;
type TestVE = { name?: { _errors?: string[] } };

// Test action type
type TestAction = SingleInputActionFn<string, TestSchema, TestVE, { id: number }>;

test("mutationOptions infers TData from action Data type", () => {
	const action = (() => Promise.resolve({ data: { id: 1 } })) as unknown as TestAction;
	const opts = mutationOptions(action);
	type DataType = NonNullable<Awaited<ReturnType<NonNullable<typeof opts.mutationFn>>>>;
	expectTypeOf<DataType>().toEqualTypeOf<{ id: number }>();
});

test("mutationOptions infers TError as ActionMutationError", () => {
	type Result = MutationOptionsReturn<string, TestSchema, TestVE, { id: number }>;
	type ErrorType = Result extends UseMutationOptions<any, infer E, any, any> ? E : never;
	expectTypeOf<ErrorType>().toEqualTypeOf<ActionMutationError<string, TestVE>>();
});

test("mutationOptions infers TVariables from action input schema", () => {
	type Result = MutationOptionsReturn<string, TestSchema, unknown, { id: number }>;
	type VarsType = Result extends UseMutationOptions<any, any, infer V, any> ? V : never;
	expectTypeOf<VarsType>().toEqualTypeOf<{ name: string }>();
});

test("opts parameter omits mutationFn", () => {
	const action = (() => Promise.resolve({ data: { id: 1 } })) as unknown as TestAction;
	// This should compile, all options except mutationFn are allowed
	mutationOptions(action, {
		onSuccess: (_data) => {},
		onError: (_error) => {},
		mutationKey: ["test"],
		retry: 3,
	});
});

test("onSuccess callback receives correct Data type", () => {
	const action = (() => Promise.resolve({ data: { id: 1 } })) as unknown as TestAction;
	mutationOptions(action, {
		onSuccess: (data) => {
			expectTypeOf(data).toEqualTypeOf<{ id: number }>();
		},
	});
});

test("onError callback receives ActionMutationError with correct generics", () => {
	const action = (() => Promise.resolve({ data: { id: 1 } })) as unknown as TestAction;
	mutationOptions(action, {
		onError: (error) => {
			expectTypeOf(error).toEqualTypeOf<ActionMutationError<string, TestVE>>();
		},
	});
});

test("InferMutationOptions infers from SingleInputActionFn", () => {
	type Inferred = InferMutationOptions<TestAction>;
	type InferredData = Inferred extends UseMutationOptions<infer D, any, any, any> ? D : never;
	type InferredVars = Inferred extends UseMutationOptions<any, any, infer V, any> ? V : never;
	expectTypeOf<InferredData>().toEqualTypeOf<{ id: number }>();
	expectTypeOf<InferredVars>().toEqualTypeOf<{ name: string }>();
});

test("InferActionMutationError infers from SingleInputActionFn", () => {
	type Inferred = InferActionMutationError<TestAction>;
	expectTypeOf<Inferred>().toEqualTypeOf<ActionMutationError<string, TestVE>>();
});

test("actions with no schema produce void input type", () => {
	type Result = MutationOptionsReturn<string, undefined, unknown, { id: number }>;
	type VarsType = Result extends UseMutationOptions<any, any, infer V, any> ? V : never;
	expectTypeOf<VarsType>().toEqualTypeOf<void>();
});
