import { describe, expect, it, vi } from "vitest";
import { ActionMutationError, isActionMutationError } from "../errors";
import { mutationOptions } from "../index";

// Helper: create a mock safe action function that resolves with a result
function createMockAction<Data>(result: { data?: Data; serverError?: string; validationErrors?: unknown }) {
	return vi.fn().mockResolvedValue(result);
}

// Helper: create a mock navigation error (has digest property like Next.js redirect errors)
function createNavigationError(digest: string) {
	const error = new Error("Navigation error");
	(error as any).digest = digest;
	return error;
}

// Mock MutationFunctionContext, we only need an empty-ish object for unit tests.
const ctx = {} as any;

describe("mutationOptions", () => {
	it("should return an object with a mutationFn", () => {
		const action = createMockAction({ data: { id: 1 } });
		const opts = mutationOptions(action);
		expect(opts).toHaveProperty("mutationFn");
		expect(typeof opts.mutationFn).toBe("function");
	});

	it("should pass through additional mutation options", () => {
		const action = createMockAction({ data: { id: 1 } });
		const onSuccess = vi.fn();
		const onError = vi.fn();
		const opts = mutationOptions(action, {
			onSuccess,
			onError,
			mutationKey: ["test"],
		});
		expect(opts.onSuccess).toBe(onSuccess);
		expect(opts.onError).toBe(onError);
		expect(opts.mutationKey).toEqual(["test"]);
	});

	it("should not allow user opts to override mutationFn", () => {
		const action = createMockAction({ data: { id: 1 } });
		const customFn = vi.fn();
		// @ts-expect-error mutationFn is omitted from opts type
		const opts = mutationOptions(action, { mutationFn: customFn });
		expect(opts.mutationFn).not.toBe(customFn);
	});

	describe("mutationFn", () => {
		it("should return data on successful action", async () => {
			const action = createMockAction({ data: { id: 1, name: "Test" } });
			const opts = mutationOptions(action);
			const result = await opts.mutationFn({ name: "Test" }, ctx);
			expect(result).toEqual({ id: 1, name: "Test" });
			expect(action).toHaveBeenCalledWith({ name: "Test" });
		});

		it("should throw ActionMutationError when result has serverError", async () => {
			const action = createMockAction({ serverError: "Internal server error" });
			const opts = mutationOptions(action);

			await expect(opts.mutationFn({ name: "Test" }, ctx)).rejects.toThrow(ActionMutationError);

			try {
				await opts.mutationFn({ name: "Test" }, ctx);
			} catch (e) {
				expect(isActionMutationError(e)).toBe(true);
				const err = e as ActionMutationError<string, unknown>;
				expect(err.serverError).toBe("Internal server error");
				expect(err.validationErrors).toBeUndefined();
				expect(err.kind).toBe("server");
			}
		});

		it("should throw ActionMutationError when result has validationErrors", async () => {
			const ve = { name: { _errors: ["Required"] } };
			const action = createMockAction({ validationErrors: ve });
			const opts = mutationOptions(action);

			await expect(opts.mutationFn({ name: "" }, ctx)).rejects.toThrow(ActionMutationError);

			try {
				await opts.mutationFn({ name: "" }, ctx);
			} catch (e) {
				const err = e as ActionMutationError<string, typeof ve>;
				expect(err.validationErrors).toEqual(ve);
				expect(err.serverError).toBeUndefined();
				expect(err.kind).toBe("validation");
			}
		});

		it("should throw ActionMutationError with both errors when result has both", async () => {
			expect.assertions(3);
			const action = createMockAction({
				serverError: "Server failed",
				validationErrors: { _errors: ["Bad input"] },
			});
			const opts = mutationOptions(action);

			try {
				await opts.mutationFn({}, ctx);
			} catch (e) {
				const err = e as ActionMutationError<string, unknown>;
				expect(err.kind).toBe("both");
				expect(err.serverError).toBe("Server failed");
				expect(err.validationErrors).toEqual({ _errors: ["Bad input"] });
			}
		});

		it("should re-throw navigation errors (redirect) untouched", async () => {
			const navError = createNavigationError("NEXT_REDIRECT;replace;/dashboard;303;");
			const action = vi.fn().mockRejectedValue(navError);
			const opts = mutationOptions(action);

			await expect(opts.mutationFn({}, ctx)).rejects.toThrow(navError);

			try {
				await opts.mutationFn({}, ctx);
			} catch (e) {
				// Should be the exact same error, not wrapped in ActionMutationError
				expect(e).toBe(navError);
				expect(isActionMutationError(e)).toBe(false);
			}
		});

		it("should re-throw navigation errors (notFound) untouched", async () => {
			const navError = createNavigationError("NEXT_HTTP_ERROR_FALLBACK;404");
			const action = vi.fn().mockRejectedValue(navError);
			const opts = mutationOptions(action);

			await expect(opts.mutationFn({}, ctx)).rejects.toThrow(navError);
		});

		it("should re-throw unknown errors as-is", async () => {
			const unknownError = new Error("Unexpected failure");
			const action = vi.fn().mockRejectedValue(unknownError);
			const opts = mutationOptions(action);

			await expect(opts.mutationFn({}, ctx)).rejects.toThrow(unknownError);

			try {
				await opts.mutationFn({}, ctx);
			} catch (e) {
				expect(e).toBe(unknownError);
				expect(isActionMutationError(e)).toBe(false);
			}
		});

		it("should handle undefined data in successful result", async () => {
			const action = createMockAction({});
			const opts = mutationOptions(action);
			const result = await opts.mutationFn({}, ctx);
			expect(result).toBeUndefined();
		});

		it("should call the action with the provided input", async () => {
			const action = createMockAction({ data: "ok" });
			const opts = mutationOptions(action);
			const input = { email: "test@example.com", name: "Test User" };
			await opts.mutationFn(input, ctx);
			expect(action).toHaveBeenCalledWith(input);
		});
	});

	describe("throwOnError", () => {
		// Helper to call throwOnError since the return type is `boolean | function`.
		// The factory always sets it to a function, but the type union requires a cast.
		function callThrowOnError(opts: ReturnType<typeof mutationOptions>, error: unknown) {
			const toe = opts.throwOnError as (error: unknown) => boolean;
			return toe(error);
		}

		it("should return true for navigation errors (redirect)", () => {
			const action = createMockAction({ data: "ok" });
			const opts = mutationOptions(action);
			const navError = createNavigationError("NEXT_REDIRECT;replace;/dashboard;303;");
			expect(callThrowOnError(opts, navError)).toBe(true);
		});

		it("should return true for navigation errors (notFound)", () => {
			const action = createMockAction({ data: "ok" });
			const opts = mutationOptions(action);
			const navError = createNavigationError("NEXT_HTTP_ERROR_FALLBACK;404");
			expect(callThrowOnError(opts, navError)).toBe(true);
		});

		it("should return false for non-navigation errors by default", () => {
			const action = createMockAction({ data: "ok" });
			const opts = mutationOptions(action);
			const error = new ActionMutationError({ serverError: "fail" });
			expect(callThrowOnError(opts, error)).toBe(false);
		});

		it("should defer to user throwOnError function for non-navigation errors", () => {
			const action = createMockAction({ data: "ok" });
			const userFn = vi.fn().mockReturnValue(true);
			const opts = mutationOptions(action, { throwOnError: userFn });
			const error = new ActionMutationError({ serverError: "fail" });
			expect(callThrowOnError(opts, error)).toBe(true);
			expect(userFn).toHaveBeenCalledWith(error);
		});

		it("should defer to user throwOnError boolean for non-navigation errors", () => {
			const action = createMockAction({ data: "ok" });
			const opts = mutationOptions(action, { throwOnError: true });
			const error = new ActionMutationError({ serverError: "fail" });
			expect(callThrowOnError(opts, error)).toBe(true);
		});

		it("should always return true for navigation errors even when user sets throwOnError to false", () => {
			const action = createMockAction({ data: "ok" });
			const opts = mutationOptions(action, { throwOnError: false });
			const navError = createNavigationError("NEXT_REDIRECT;replace;/home;303;");
			expect(callThrowOnError(opts, navError)).toBe(true);
		});
	});

	describe("retry", () => {
		function callRetry(opts: ReturnType<typeof mutationOptions>, failureCount: number, error: unknown) {
			const retry = opts.retry as (failureCount: number, error: unknown) => boolean;
			return retry(failureCount, error);
		}

		it("should return false for navigation errors (redirect)", () => {
			const action = createMockAction({ data: "ok" });
			const opts = mutationOptions(action);
			const navError = createNavigationError("NEXT_REDIRECT;replace;/dashboard;303;");
			expect(callRetry(opts, 0, navError)).toBe(false);
		});

		it("should return false for navigation errors (notFound)", () => {
			const action = createMockAction({ data: "ok" });
			const opts = mutationOptions(action);
			const navError = createNavigationError("NEXT_HTTP_ERROR_FALLBACK;404");
			expect(callRetry(opts, 0, navError)).toBe(false);
		});

		it("should return false by default for non-navigation errors", () => {
			const action = createMockAction({ data: "ok" });
			const opts = mutationOptions(action);
			const error = new ActionMutationError({ serverError: "fail" });
			expect(callRetry(opts, 0, error)).toBe(false);
		});

		it("should defer to user retry function for non-navigation errors", () => {
			const action = createMockAction({ data: "ok" });
			const userFn = vi.fn().mockReturnValue(true);
			const opts = mutationOptions(action, { retry: userFn });
			const error = new ActionMutationError({ serverError: "fail" });
			expect(callRetry(opts, 0, error)).toBe(true);
			expect(userFn).toHaveBeenCalledWith(0, error);
		});

		it("should defer to user retry number for non-navigation errors", () => {
			const action = createMockAction({ data: "ok" });
			const opts = mutationOptions(action, { retry: 3 });
			const error = new ActionMutationError({ serverError: "fail" });
			expect(callRetry(opts, 0, error)).toBe(true);
			expect(callRetry(opts, 2, error)).toBe(true);
			expect(callRetry(opts, 3, error)).toBe(false);
		});

		it("should always return false for navigation errors even when user sets retry to 3", () => {
			const action = createMockAction({ data: "ok" });
			const opts = mutationOptions(action, { retry: 3 });
			const navError = createNavigationError("NEXT_REDIRECT;replace;/home;303;");
			expect(callRetry(opts, 0, navError)).toBe(false);
		});

		it("should always return false for navigation errors even when user retry function returns true", () => {
			const action = createMockAction({ data: "ok" });
			const userFn = vi.fn().mockReturnValue(true);
			const opts = mutationOptions(action, { retry: userFn });
			const navError = createNavigationError("NEXT_REDIRECT;replace;/home;303;");
			expect(callRetry(opts, 0, navError)).toBe(false);
			expect(userFn).not.toHaveBeenCalled();
		});
	});
});
