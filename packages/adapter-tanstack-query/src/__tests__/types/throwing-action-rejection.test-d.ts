import type { ThrowsErrorsBrand } from "next-safe-action";
import type { SingleInputActionFn } from "next-safe-action/hooks";
import { expectTypeOf, test } from "vitest";
import { mutationOptions } from "../../index";
import type { StandardSchemaV1 } from "../../standard-schema";

// Test schema and action types
type TestSchema = StandardSchemaV1<{ name: string }, { name: string }>;
type TestVE = { name?: { _errors?: string[] } };

// Non-throwing action: plain SingleInputActionFn
type NonThrowingAction = SingleInputActionFn<string, TestSchema, TestVE, { id: number }>;

// Throwing action: SingleInputActionFn branded with ThrowsErrorsBrand
type ThrowingAction = SingleInputActionFn<string, TestSchema, TestVE, { id: number }> & ThrowsErrorsBrand;

test("mutationOptions accepts non-throwing actions", () => {
	const action = (() => Promise.resolve({ data: { id: 1 } })) as unknown as NonThrowingAction;
	// Should compile without errors
	const opts = mutationOptions(action);
	expectTypeOf(opts).toHaveProperty("mutationFn");
});

test("mutationOptions rejects throwing (branded) actions", () => {
	const action = (() => Promise.resolve({ data: { id: 1 } })) as unknown as ThrowingAction;
	// @ts-expect-error - branded actions should be rejected by NonThrowingActionConstraint
	mutationOptions(action);
});

test("non-throwing action opts return type has mutationFn", () => {
	const action = (() => Promise.resolve({ data: { id: 1 } })) as unknown as NonThrowingAction;
	const opts = mutationOptions(action);
	type DataType = NonNullable<Awaited<ReturnType<NonNullable<typeof opts.mutationFn>>>>;
	expectTypeOf<DataType>().toEqualTypeOf<{ id: number }>();
});
