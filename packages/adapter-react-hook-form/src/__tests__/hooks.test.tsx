import { renderHook, act } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach } from "vitest";
import type { UseFormReturn } from "react-hook-form";

// vi.hoisted() ensures these are available when the hoisted vi.mock factory runs.
const { mockUseAction, mockUseOptimisticAction } = vi.hoisted(() => ({
	mockUseAction: vi.fn(),
	mockUseOptimisticAction: vi.fn(),
}));

vi.mock("next-safe-action/hooks", () => ({
	useAction: mockUseAction,
	useOptimisticAction: mockUseOptimisticAction,
}));

import { useHookFormActionErrorMapper, useHookFormAction, useHookFormOptimisticAction } from "../hooks";

// Fake safe action function (just a callable — the mock controls useAction's behavior).
const fakeSafeAction = vi.fn() as any;

// Fake resolver that always passes validation, forwarding actual form values.
const fakeResolver: any = (values: any) => ({ values, errors: {} });

// Helper to build a mock return value matching UseActionHookReturn shape.
function createMockActionReturn(overrides: Record<string, any> = {}) {
	return {
		execute: vi.fn(),
		executeAsync: vi.fn().mockResolvedValue({}),
		input: undefined,
		result: {},
		reset: vi.fn(),
		status: "idle" as const,
		isIdle: true,
		isExecuting: false,
		isPending: false,
		hasSucceeded: false,
		hasErrored: false,
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mockUseAction.mockReturnValue(createMockActionReturn());
	mockUseOptimisticAction.mockReturnValue({ ...createMockActionReturn(), optimisticState: null });
});

// ─── useHookFormActionErrorMapper ────────────────────────────────────────────

describe("useHookFormActionErrorMapper", () => {
	test("returns undefined when there are no validation errors", () => {
		const { result } = renderHook(() => useHookFormActionErrorMapper(undefined));
		expect(result.current.hookFormValidationErrors).toBeUndefined();
	});

	test("maps validation errors to hook form field errors", () => {
		const validationErrors = {
			name: { _errors: ["Required"] },
			email: { _errors: ["Invalid"] },
		};

		const { result } = renderHook(() => useHookFormActionErrorMapper(validationErrors));

		expect(result.current.hookFormValidationErrors).toEqual({
			name: { type: "validate", message: "Required" },
			email: { type: "validate", message: "Invalid" },
		});
	});

	test("passes errorMapProps through to mapToHookFormErrors", () => {
		const validationErrors = {
			name: { _errors: ["Too short", "Invalid chars"] },
		};

		const { result } = renderHook(() => useHookFormActionErrorMapper(validationErrors, { joinBy: " | " }));

		expect(result.current.hookFormValidationErrors).toEqual({
			name: { type: "validate", message: "Too short | Invalid chars" },
		});
	});
});

// ─── useHookFormAction ───────────────────────────────────────────────────────

describe("useHookFormAction", () => {
	test("returns action, form, handleSubmitWithAction, and resetFormAndAction", () => {
		const { result } = renderHook(() => useHookFormAction(fakeSafeAction, fakeResolver));

		expect(result.current).toHaveProperty("action");
		expect(result.current).toHaveProperty("form");
		expect(result.current).toHaveProperty("handleSubmitWithAction");
		expect(result.current).toHaveProperty("resetFormAndAction");
		expect(typeof result.current.handleSubmitWithAction).toBe("function");
		expect(typeof result.current.resetFormAndAction).toBe("function");
	});

	test("passes actionProps callbacks to useAction", () => {
		const onSuccess = vi.fn();
		const onError = vi.fn();

		renderHook(() =>
			useHookFormAction(fakeSafeAction, fakeResolver, {
				actionProps: { onSuccess, onError },
			})
		);

		expect(mockUseAction).toHaveBeenCalledWith(fakeSafeAction, { onSuccess, onError });
	});

	test("passes formProps to useForm (form has defaultValues)", () => {
		const { result } = renderHook(() =>
			useHookFormAction(fakeSafeAction, fakeResolver, {
				formProps: {
					defaultValues: { name: "test" },
				},
			})
		);

		// react-hook-form's useForm picks up defaultValues — the form's initial value reflects it.
		const form = result.current.form as UseFormReturn<{ name: string }>;
		expect(form.getValues("name")).toBe("test");
	});

	test("maps server validation errors to form field errors", () => {
		const validationErrors = {
			name: { _errors: ["Server says: required"] },
		};

		mockUseAction.mockReturnValue(
			createMockActionReturn({
				result: { validationErrors },
			})
		);

		const { result } = renderHook(() => useHookFormAction(fakeSafeAction, fakeResolver));

		// The form should have the mapped errors available.
		const form = result.current.form as UseFormReturn<{ name: string }>;
		const nameError = form.formState.errors.name;
		expect(nameError).toBeDefined();
		expect(nameError?.type).toBe("validate");
		expect(nameError?.message).toBe("Server says: required");
	});

	test("handleSubmitWithAction calls executeAsync with form data", async () => {
		const mockExecuteAsync = vi.fn().mockResolvedValue({});
		mockUseAction.mockReturnValue(
			createMockActionReturn({
				executeAsync: mockExecuteAsync,
			})
		);

		const { result } = renderHook(() =>
			useHookFormAction(fakeSafeAction, fakeResolver, {
				formProps: { defaultValues: { name: "John" } },
			})
		);

		await act(async () => {
			await result.current.handleSubmitWithAction();
		});

		// The fake resolver always passes, so executeAsync should be called with form values.
		// react-hook-form's handleSubmit passes (data, event) — so executeAsync also gets the event arg.
		expect(mockExecuteAsync).toHaveBeenCalledWith({ name: "John" }, undefined);
	});

	test("resetFormAndAction resets both form and action", () => {
		const mockResetAction = vi.fn();
		mockUseAction.mockReturnValue(
			createMockActionReturn({
				reset: mockResetAction,
			})
		);

		const { result } = renderHook(() =>
			useHookFormAction(fakeSafeAction, fakeResolver, {
				formProps: { defaultValues: { name: "" } },
			})
		);

		// Set a form value to verify reset clears it.
		act(() => {
			result.current.form.setValue("name", "dirty");
		});

		act(() => {
			result.current.resetFormAndAction();
		});

		expect(mockResetAction).toHaveBeenCalled();
		// Form should be reset to default values.
		expect(result.current.form.getValues("name")).toBe("");
	});

	test("forwards custom errorMapProps joinBy", () => {
		const validationErrors = {
			name: { _errors: ["A", "B"] },
		};

		mockUseAction.mockReturnValue(
			createMockActionReturn({
				result: { validationErrors },
			})
		);

		const { result } = renderHook(() =>
			useHookFormAction(fakeSafeAction, fakeResolver, {
				errorMapProps: { joinBy: " & " },
			})
		);

		const form = result.current.form as UseFormReturn<{ name: string }>;
		expect(form.formState.errors.name?.message).toBe("A & B");
	});
});

// ─── useHookFormOptimisticAction ─────────────────────────────────────────────

describe("useHookFormOptimisticAction", () => {
	const optimisticProps = {
		actionProps: {
			currentState: { count: 0 },
			updateFn: (state: { count: number }) => ({ count: state.count + 1 }),
		},
	};

	test("returns action, form, handleSubmitWithAction, and resetFormAndAction", () => {
		const { result } = renderHook(() =>
			useHookFormOptimisticAction(fakeSafeAction, fakeResolver, optimisticProps)
		);

		expect(result.current).toHaveProperty("action");
		expect(result.current).toHaveProperty("form");
		expect(result.current).toHaveProperty("handleSubmitWithAction");
		expect(result.current).toHaveProperty("resetFormAndAction");
	});

	test("passes currentState and updateFn to useOptimisticAction", () => {
		renderHook(() => useHookFormOptimisticAction(fakeSafeAction, fakeResolver, optimisticProps));

		expect(mockUseOptimisticAction).toHaveBeenCalledWith(fakeSafeAction, optimisticProps.actionProps);
	});

	test("action return includes optimisticState", () => {
		mockUseOptimisticAction.mockReturnValue({
			...createMockActionReturn(),
			optimisticState: { count: 42 },
		});

		const { result } = renderHook(() =>
			useHookFormOptimisticAction(fakeSafeAction, fakeResolver, optimisticProps)
		);

		expect(result.current.action.optimisticState).toEqual({ count: 42 });
	});

	test("maps server validation errors to form field errors", () => {
		const validationErrors = {
			email: { _errors: ["Already taken"] },
		};

		mockUseOptimisticAction.mockReturnValue({
			...createMockActionReturn({ result: { validationErrors } }),
			optimisticState: { count: 0 },
		});

		const { result } = renderHook(() =>
			useHookFormOptimisticAction(fakeSafeAction, fakeResolver, optimisticProps)
		);

		const form = result.current.form as UseFormReturn<{ email: string }>;
		expect(form.formState.errors.email?.message).toBe("Already taken");
	});

	test("handleSubmitWithAction calls executeAsync with form data", async () => {
		const mockExecuteAsync = vi.fn().mockResolvedValue({});
		mockUseOptimisticAction.mockReturnValue({
			...createMockActionReturn({ executeAsync: mockExecuteAsync }),
			optimisticState: { count: 0 },
		});

		const { result } = renderHook(() =>
			useHookFormOptimisticAction(fakeSafeAction, fakeResolver, {
				...optimisticProps,
				formProps: { defaultValues: { name: "Jane" } },
			})
		);

		await act(async () => {
			await result.current.handleSubmitWithAction();
		});

		expect(mockExecuteAsync).toHaveBeenCalledWith({ name: "Jane" }, undefined);
	});

	test("resetFormAndAction resets both form and action", () => {
		const mockResetAction = vi.fn();
		mockUseOptimisticAction.mockReturnValue({
			...createMockActionReturn({ reset: mockResetAction }),
			optimisticState: { count: 0 },
		});

		const { result } = renderHook(() =>
			useHookFormOptimisticAction(fakeSafeAction, fakeResolver, {
				...optimisticProps,
				formProps: { defaultValues: { name: "" } },
			})
		);

		act(() => {
			result.current.form.setValue("name", "dirty");
		});

		act(() => {
			result.current.resetFormAndAction();
		});

		expect(mockResetAction).toHaveBeenCalled();
		expect(result.current.form.getValues("name")).toBe("");
	});
});
