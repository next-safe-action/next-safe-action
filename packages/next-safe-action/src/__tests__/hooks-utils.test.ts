import { describe, expect, test } from "vitest";
import { getActionShorthandStatusObject, getActionStatus } from "../hooks-utils";
import type { SafeActionResult } from "../index.types";

type TestResult = SafeActionResult<string, undefined, undefined, { ok: boolean }>;

// ─── getActionStatus ─────────────────────────────────────────────────────────

describe("getActionStatus", () => {
	test("returns hasSucceeded after execution completes", () => {
		const result: TestResult = {
			data: {
				ok: true,
			},
		};

		const status = getActionStatus({
			isIdle: false,
			isExecuting: false,
			hasNavigated: false,
			hasThrownError: false,
			result,
		});

		expect(status).toBe("hasSucceeded");
	});

	test("keeps error precedence over success", () => {
		const status = getActionStatus({
			isIdle: false,
			isExecuting: false,
			hasNavigated: false,
			hasThrownError: true,
			result: {},
		});

		expect(status).toBe("hasErrored");
	});

	test("executing status remains executing", () => {
		const status = getActionStatus({
			isIdle: false,
			isExecuting: true,
			hasNavigated: false,
			hasThrownError: false,
			result: {},
		});

		expect(status).toBe("executing");
	});

	test("returns idle when isIdle is true even with data in result", () => {
		const result: TestResult = { data: { ok: true } };

		const status = getActionStatus({
			isIdle: true,
			isExecuting: false,
			hasNavigated: false,
			hasThrownError: false,
			result,
		});

		expect(status).toBe("idle");
	});

	test("idle takes precedence over everything", () => {
		const status = getActionStatus({
			isIdle: true,
			isExecuting: true,
			hasNavigated: true,
			hasThrownError: true,
			result: { serverError: "boom" as string },
		});

		expect(status).toBe("idle");
	});

	test("returns hasErrored when validationErrors present", () => {
		const result: TestResult = {
			validationErrors: { _errors: ["Invalid"] } as any,
		};

		const status = getActionStatus({
			isIdle: false,
			isExecuting: false,
			hasNavigated: false,
			hasThrownError: false,
			result,
		});

		expect(status).toBe("hasErrored");
	});

	test("returns hasErrored when serverError present", () => {
		const status = getActionStatus({
			isIdle: false,
			isExecuting: false,
			hasNavigated: false,
			hasThrownError: false,
			result: { serverError: "Internal error" as string },
		});

		expect(status).toBe("hasErrored");
	});

	test("returns hasNavigated when hasNavigated and no errors", () => {
		const status = getActionStatus({
			isIdle: false,
			isExecuting: false,
			hasNavigated: true,
			hasThrownError: false,
			result: {},
		});

		expect(status).toBe("hasNavigated");
	});

	test("error takes precedence over navigation", () => {
		const status = getActionStatus({
			isIdle: false,
			isExecuting: false,
			hasNavigated: true,
			hasThrownError: true,
			result: {},
		});

		expect(status).toBe("hasErrored");
	});
});

// ─── formAction path: isIdle && !isExecuting ────────────────────────────────
// useStateAction computes isIdle as (isIdle && !isExecuting) to handle the
// formAction submission path where isIdle hasn't been committed yet but
// isExecuting (from useActionState's isPending) is already true.

describe("getActionStatus with formAction path (isIdle overridden by isExecuting)", () => {
	test("returns executing when isIdle is true but isExecuting is true (formAction first render)", () => {
		const status = getActionStatus({
			isIdle: false, // computed as: true && !true = false
			isExecuting: true,
			hasNavigated: false,
			hasThrownError: false,
			result: {},
		});

		expect(status).toBe("executing");
	});

	test("returns hasSucceeded after formAction completion (isIdle committed as false)", () => {
		const result: TestResult = { data: { ok: true } };

		const status = getActionStatus({
			isIdle: false,
			isExecuting: false,
			hasNavigated: false,
			hasThrownError: false,
			result,
		});

		expect(status).toBe("hasSucceeded");
	});

	test("returns hasNavigated when navigation error occurred during formAction", () => {
		const status = getActionStatus({
			isIdle: false,
			isExecuting: false,
			hasNavigated: true,
			hasThrownError: false,
			result: {},
		});

		expect(status).toBe("hasNavigated");
	});
});

// ─── getActionShorthandStatusObject ──────────────────────────────────────────

describe("getActionShorthandStatusObject", () => {
	test("idle status maps correctly", () => {
		const shorthand = getActionShorthandStatusObject({
			status: "idle",
			isTransitioning: false,
		});

		expect(shorthand.isIdle).toBe(true);
		expect(shorthand.isExecuting).toBe(false);
		expect(shorthand.isTransitioning).toBe(false);
		expect(shorthand.isPending).toBe(false);
		expect(shorthand.hasSucceeded).toBe(false);
		expect(shorthand.hasErrored).toBe(false);
		expect(shorthand.hasNavigated).toBe(false);
	});

	test("executing status maps correctly", () => {
		const shorthand = getActionShorthandStatusObject({
			status: "executing",
			isTransitioning: false,
		});

		expect(shorthand.isExecuting).toBe(true);
		expect(shorthand.isPending).toBe(true);
		expect(shorthand.isIdle).toBe(false);
	});

	test("can be succeeded while still transitioning", () => {
		const shorthand = getActionShorthandStatusObject({
			status: "hasSucceeded",
			isTransitioning: true,
		});

		expect(shorthand.hasSucceeded).toBe(true);
		expect(shorthand.isTransitioning).toBe(true);
		expect(shorthand.isPending).toBe(true);
	});

	test("hasErrored status maps correctly", () => {
		const shorthand = getActionShorthandStatusObject({
			status: "hasErrored",
			isTransitioning: false,
		});

		expect(shorthand.hasErrored).toBe(true);
		expect(shorthand.isPending).toBe(false);
		expect(shorthand.hasSucceeded).toBe(false);
	});

	test("hasNavigated status maps correctly", () => {
		const shorthand = getActionShorthandStatusObject({
			status: "hasNavigated",
			isTransitioning: false,
		});

		expect(shorthand.hasNavigated).toBe(true);
		expect(shorthand.hasErrored).toBe(false);
		expect(shorthand.hasSucceeded).toBe(false);
	});

	test("isPending true when only transitioning", () => {
		const shorthand = getActionShorthandStatusObject({
			status: "hasSucceeded",
			isTransitioning: true,
		});

		expect(shorthand.isPending).toBe(true);
		expect(shorthand.isExecuting).toBe(false);
	});
});
