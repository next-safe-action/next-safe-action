import { expect, test } from "vitest";
import { getActionShorthandStatusObject, getActionStatus } from "../hooks-utils";
import type { SafeActionResult } from "../index.types";

type TestResult = SafeActionResult<string, undefined, undefined, { ok: boolean }>;

test("getActionStatus returns hasSucceeded after execution completes", () => {
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

test("getActionStatus keeps error precedence over success", () => {
	const status = getActionStatus({
		isIdle: false,
		isExecuting: false,
		hasNavigated: false,
		hasThrownError: true,
		result: {},
	});

	expect(status).toBe("hasErrored");
});

test("shorthand status can be succeeded while still transitioning", () => {
	const shorthand = getActionShorthandStatusObject({
		status: "hasSucceeded",
		isTransitioning: true,
	});

	expect(shorthand.hasSucceeded).toBe(true);
	expect(shorthand.isTransitioning).toBe(true);
	expect(shorthand.isPending).toBe(true);
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
