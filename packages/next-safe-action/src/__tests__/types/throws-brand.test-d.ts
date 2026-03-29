import { expectTypeOf, test } from "vitest";
import type { EffectiveThrows, MaybeBrandThrows, ThrowsErrorsBrand } from "../../index.types";

// --- EffectiveThrows tests ---

test("EffectiveThrows: no utils, client false -> false", () => {
	// ActionCallbacks<...> (the default) doesn't have throwServerError: true,
	// so EffectiveThrows falls through to the client default.
	type Result = EffectiveThrows<false, {}>;
	expectTypeOf<Result>().toEqualTypeOf<false>();
});

test("EffectiveThrows: no utils, client true -> true", () => {
	type Result = EffectiveThrows<true, {}>;
	expectTypeOf<Result>().toEqualTypeOf<true>();
});

test("EffectiveThrows: throwServerError true -> true regardless of client", () => {
	type Result = EffectiveThrows<false, { throwServerError: true }>;
	expectTypeOf<Result>().toEqualTypeOf<true>();
});

test("EffectiveThrows: throwValidationErrors true -> true regardless of client", () => {
	type Result = EffectiveThrows<false, { throwValidationErrors: true }>;
	expectTypeOf<Result>().toEqualTypeOf<true>();
});

test("EffectiveThrows: throwValidationErrors object form -> true", () => {
	type Result = EffectiveThrows<false, { throwValidationErrors: { overrideErrorMessage: () => Promise<string> } }>;
	expectTypeOf<Result>().toEqualTypeOf<true>();
});

test("EffectiveThrows: action-level false overrides client true", () => {
	type Result = EffectiveThrows<true, { throwValidationErrors: false }>;
	expectTypeOf<Result>().toEqualTypeOf<false>();
});

test("EffectiveThrows: throwServerError true + throwValidationErrors false -> true", () => {
	type Result = EffectiveThrows<false, { throwServerError: true; throwValidationErrors: false }>;
	expectTypeOf<Result>().toEqualTypeOf<true>();
});

// --- MaybeBrandThrows tests ---

test("MaybeBrandThrows: false -> no brand", () => {
	type Input = () => Promise<void>;
	type Result = MaybeBrandThrows<Input, false>;
	expectTypeOf<Result>().toEqualTypeOf<Input>();
});

test("MaybeBrandThrows: true -> branded", () => {
	type Input = () => Promise<void>;
	type Result = MaybeBrandThrows<Input, true>;
	expectTypeOf<Result>().toMatchTypeOf<ThrowsErrorsBrand>();
});
