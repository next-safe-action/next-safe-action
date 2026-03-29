import { describe, expect, it } from "vitest";
import { ActionMutationError, hasServerError, hasValidationErrors, isActionMutationError } from "../errors";

describe("ActionMutationError", () => {
	it("should create an error with only serverError", () => {
		const error = new ActionMutationError({ serverError: "Something went wrong" });
		expect(error.kind).toBe("server");
		expect(error.serverError).toBe("Something went wrong");
		expect(error.validationErrors).toBeUndefined();
		expect(error.message).toBe("Action mutation failed with server error");
	});

	it("should create an error with only validationErrors", () => {
		const ve = { name: { _errors: ["Required"] } };
		const error = new ActionMutationError({ validationErrors: ve });
		expect(error.kind).toBe("validation");
		expect(error.serverError).toBeUndefined();
		expect(error.validationErrors).toEqual(ve);
		expect(error.message).toBe("Action mutation failed with validation errors");
	});

	it("should create an error with both serverError and validationErrors", () => {
		const error = new ActionMutationError({
			serverError: "Server failed",
			validationErrors: { _errors: ["Invalid"] },
		});
		expect(error.kind).toBe("both");
		expect(error.serverError).toBe("Server failed");
		expect(error.validationErrors).toEqual({ _errors: ["Invalid"] });
		expect(error.message).toBe("Action mutation failed with server error and validation errors");
	});

	it("should be an instance of Error", () => {
		const error = new ActionMutationError({ serverError: "test" });
		expect(error).toBeInstanceOf(Error);
	});

	it("should have name set to ActionMutationError", () => {
		const error = new ActionMutationError({ serverError: "test" });
		expect(error.name).toBe("ActionMutationError");
	});

	it("should have readonly properties", () => {
		const error = new ActionMutationError({ serverError: "test", validationErrors: { _errors: [] } });
		expect(error.kind).toBe("both");
		expect(error.serverError).toBe("test");
		expect(error.validationErrors).toEqual({ _errors: [] });
	});
});

describe("isActionMutationError", () => {
	it("should return true for ActionMutationError instances", () => {
		const error = new ActionMutationError({ serverError: "test" });
		expect(isActionMutationError(error)).toBe(true);
	});

	it("should return false for plain Error", () => {
		expect(isActionMutationError(new Error("test"))).toBe(false);
	});

	it("should return false for non-error values", () => {
		expect(isActionMutationError(null)).toBe(false);
		expect(isActionMutationError(undefined)).toBe(false);
		expect(isActionMutationError("string")).toBe(false);
		expect(isActionMutationError(42)).toBe(false);
	});
});

describe("hasServerError", () => {
	it("should return true when serverError is present", () => {
		const error = new ActionMutationError({ serverError: "Server failed" });
		expect(hasServerError(error)).toBe(true);
	});

	it("should return true when both errors are present", () => {
		const error = new ActionMutationError({ serverError: "fail", validationErrors: {} });
		expect(hasServerError(error)).toBe(true);
	});

	it("should return false when only validationErrors are present", () => {
		const error = new ActionMutationError({ validationErrors: { _errors: ["Required"] } });
		expect(hasServerError(error)).toBe(false);
	});
});

describe("hasValidationErrors", () => {
	it("should return true when validationErrors are present", () => {
		const error = new ActionMutationError({ validationErrors: { name: { _errors: ["Required"] } } });
		expect(hasValidationErrors(error)).toBe(true);
	});

	it("should return true when both errors are present", () => {
		const error = new ActionMutationError({ serverError: "fail", validationErrors: {} });
		expect(hasValidationErrors(error)).toBe(true);
	});

	it("should return false when only serverError is present", () => {
		const error = new ActionMutationError({ serverError: "Server failed" });
		expect(hasValidationErrors(error)).toBe(false);
	});
});
