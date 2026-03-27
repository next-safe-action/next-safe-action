import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import type { ValidationErrors, FlattenedValidationErrors } from "../../validation-errors.types";

test("ValidationErrors for simple object schema has field-level errors", () => {
	const schema = z.object({ name: z.string(), age: z.number() });
	type VE = ValidationErrors<typeof schema>;

	// Root has _errors
	expectTypeOf<NonNullable<VE>["_errors"]>().toEqualTypeOf<string[] | undefined>();

	// Each field has _errors
	expectTypeOf<NonNullable<NonNullable<VE>["name"]>>().toEqualTypeOf<{ _errors?: string[] }>();
	expectTypeOf<NonNullable<NonNullable<VE>["age"]>>().toEqualTypeOf<{ _errors?: string[] }>();
});

test("ValidationErrors for nested object schema is recursive", () => {
	const schema = z.object({
		user: z.object({
			name: z.string(),
			address: z.object({
				city: z.string(),
			}),
		}),
	});

	type VE = NonNullable<ValidationErrors<typeof schema>>;

	// Root level
	expectTypeOf<VE["_errors"]>().toEqualTypeOf<string[] | undefined>();

	// Nested field
	type UserErrors = NonNullable<VE["user"]>;
	expectTypeOf<UserErrors["_errors"]>().toEqualTypeOf<string[] | undefined>();

	// Deeply nested field
	type AddressErrors = NonNullable<UserErrors["address"]>;
	expectTypeOf<AddressErrors["_errors"]>().toEqualTypeOf<string[] | undefined>();
});

test("ValidationErrors for undefined schema is undefined", () => {
	type VE = ValidationErrors<undefined>;
	expectTypeOf<VE>().toEqualTypeOf<undefined>();
});

test("FlattenedValidationErrors has formErrors and fieldErrors", () => {
	const schema = z.object({ name: z.string(), age: z.number() });
	type VE = ValidationErrors<typeof schema>;
	type FVE = FlattenedValidationErrors<NonNullable<VE>>;

	expectTypeOf<FVE["formErrors"]>().toEqualTypeOf<string[]>();
	expectTypeOf<FVE["fieldErrors"]>().not.toBeAny();

	// Field errors have string[] | undefined for each field
	expectTypeOf<FVE["fieldErrors"]["name"]>().toEqualTypeOf<string[] | undefined>();
	expectTypeOf<FVE["fieldErrors"]["age"]>().toEqualTypeOf<string[] | undefined>();
});

test("ValidationErrors is not any", () => {
	const schema = z.object({ name: z.string() });
	type VE = ValidationErrors<typeof schema>;
	expectTypeOf<VE>().not.toBeAny();
});
