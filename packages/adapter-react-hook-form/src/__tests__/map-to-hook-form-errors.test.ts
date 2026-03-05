import { describe, expect, test } from "vitest";
import { mapToHookFormErrors } from "../index";

// We use `as any` for validation error inputs because `mapToHookFormErrors` is generic over a
// StandardSchemaV1 type. Without a real schema, TypeScript restricts the input to root-level
// `_errors` only. Since we're testing the runtime mapping logic, type assertions are appropriate.

describe("mapToHookFormErrors", () => {
	test("returns undefined for undefined input", () => {
		expect(mapToHookFormErrors(undefined)).toBeUndefined();
	});

	test("returns undefined for empty object", () => {
		expect(mapToHookFormErrors({})).toBeUndefined();
	});

	test("maps single field with single error", () => {
		const result = mapToHookFormErrors({
			name: { _errors: ["Required"] },
		} as any);

		expect(result).toEqual({
			name: { type: "validate", message: "Required" },
		});
	});

	test("joins multiple errors with space by default", () => {
		const result = mapToHookFormErrors({
			name: { _errors: ["Too short", "Must be alphanumeric"] },
		} as any);

		expect(result).toEqual({
			name: { type: "validate", message: "Too short Must be alphanumeric" },
		});
	});

	test("joins multiple errors with custom joinBy", () => {
		const result = mapToHookFormErrors(
			{
				name: { _errors: ["Too short", "Must be alphanumeric"] },
			} as any,
			{ joinBy: ", " }
		);

		expect(result).toEqual({
			name: { type: "validate", message: "Too short, Must be alphanumeric" },
		});
	});

	test("maps multiple fields independently", () => {
		const result = mapToHookFormErrors({
			name: { _errors: ["Required"] },
			email: { _errors: ["Invalid email"] },
		} as any);

		expect(result).toEqual({
			name: { type: "validate", message: "Required" },
			email: { type: "validate", message: "Invalid email" },
		});
	});

	test("maps nested object errors", () => {
		const result = mapToHookFormErrors({
			address: {
				street: { _errors: ["Required"] },
			},
		} as any);

		expect(result).toEqual({
			address: {
				street: { type: "validate", message: "Required" },
			},
		});
	});

	test("maps deeply nested errors (3+ levels)", () => {
		const result = mapToHookFormErrors({
			user: {
				profile: {
					address: {
						zipCode: { _errors: ["Invalid zip code"] },
					},
				},
			},
		} as any);

		expect(result).toEqual({
			user: {
				profile: {
					address: {
						zipCode: { type: "validate", message: "Invalid zip code" },
					},
				},
			},
		});
	});

	test("maps root-level _errors to 'root' key", () => {
		const result = mapToHookFormErrors({
			_errors: ["Form is invalid"],
		});

		expect(result).toEqual({
			root: { type: "validate", message: "Form is invalid" },
		});
	});

	test("maps both root and field errors", () => {
		const result = mapToHookFormErrors({
			_errors: ["Form is invalid"],
			name: { _errors: ["Required"] },
		} as any);

		expect(result).toEqual({
			root: { type: "validate", message: "Form is invalid" },
			name: { type: "validate", message: "Required" },
		});
	});

	test("produces empty message string for empty _errors array", () => {
		const result = mapToHookFormErrors({
			name: { _errors: [] },
		} as any);

		expect(result).toEqual({
			name: { type: "validate", message: "" },
		});
	});

	test("handles mixed nested and flat fields", () => {
		const result = mapToHookFormErrors({
			name: { _errors: ["Required"] },
			address: {
				street: { _errors: ["Too short"] },
				city: { _errors: ["Required"] },
			},
		} as any);

		expect(result).toEqual({
			name: { type: "validate", message: "Required" },
			address: {
				street: { type: "validate", message: "Too short" },
				city: { type: "validate", message: "Required" },
			},
		});
	});

	test("handles nested object with _errors at multiple levels", () => {
		const result = mapToHookFormErrors({
			address: {
				_errors: ["Address is invalid"],
				street: { _errors: ["Required"] },
			},
		} as any);

		expect(result).toEqual({
			address: {
				type: "validate",
				message: "Address is invalid",
				street: { type: "validate", message: "Required" },
			},
		});
	});
});
