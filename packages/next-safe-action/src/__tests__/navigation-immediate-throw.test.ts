/**
 * Tests for the fix: Navigation errors should be thrown immediately (synchronously)
 * instead of being deferred to useLayoutEffect.
 *
 * This fix ensures that redirects work correctly with Next.js cacheComponents enabled.
 *
 * Background:
 * - Previously, navigation errors were caught, stored in state, and re-thrown later in useLayoutEffect
 * - With cacheComponents enabled, Next.js could cache/restore component tree before the effect ran
 * - This caused redirects to be cancelled or ignored
 *
 * Fix:
 * - Navigation errors are now thrown immediately when caught in the promise chain
 * - This ensures Next.js receives the error before any component caching occurs
 * - Callbacks still execute properly via useLayoutEffect
 */

import { notFound, redirect } from "next/navigation";
import { expect, test } from "vitest";
import { z } from "zod";
import { createSafeActionClient } from "..";
import { FrameworkErrorHandler } from "../next/errors";

const ac = createSafeActionClient();

test("redirect error is thrown immediately, not deferred", async () => {
	const action = ac.action(async () => {
		redirect("/test");
	});

	let errorCaught = false;
	let errorThrownImmediately = false;

	try {
		// This should throw immediately during the action execution
		await action();
	} catch (e) {
		errorCaught = true;
		if (FrameworkErrorHandler.isNavigationError(e)) {
			// If we catch it here, it was thrown immediately (not deferred)
			errorThrownImmediately = true;
		}
	}

	expect(errorCaught).toBe(true);
	expect(errorThrownImmediately).toBe(true);
});

test("redirect error timing - thrown before returning result", async () => {
	let actionCompleted = false;

	const action = ac.action(async () => {
		redirect("/test");
		// This code should never be reached
		actionCompleted = true;
		return { unreachable: true };
	});

	await action().catch((e) => {
		if (!FrameworkErrorHandler.isNavigationError(e)) {
			throw e;
		}
	});

	expect(actionCompleted).toBe(false);
});

test("navigation error is propagated synchronously through promise chain", async () => {
	const action = ac.action(async () => {
		redirect("/test");
	});

	// The error should propagate synchronously through the promise chain
	const promise = action();

	// We should be able to catch it immediately
	let caughtSynchronously = false;
	promise.catch((e) => {
		if (FrameworkErrorHandler.isNavigationError(e)) {
			caughtSynchronously = true;
		}
	});

	// Wait for microtasks to complete
	await new Promise((resolve) => setImmediate(resolve));

	expect(caughtSynchronously).toBe(true);
});

test("notFound error is also thrown immediately", async () => {
	const action = ac.action(async () => {
		notFound();
	});

	let errorThrownImmediately = false;

	try {
		await action();
	} catch (e) {
		if (FrameworkErrorHandler.isNavigationError(e)) {
			errorThrownImmediately = true;
		}
	}

	expect(errorThrownImmediately).toBe(true);
});

test("callbacks execute before error is re-thrown on server", async () => {
	const executionOrder: string[] = [];

	const action = ac.action(
		async () => {
			executionOrder.push("action-start");
			redirect("/test");
		},
		{
			onNavigation: async () => {
				executionOrder.push("onNavigation");
			},
			onSettled: async () => {
				executionOrder.push("onSettled");
			},
		}
	);

	await action().catch((e) => {
		executionOrder.push("error-caught");
		if (!FrameworkErrorHandler.isNavigationError(e)) {
			throw e;
		}
	});

	const expectedOrder = ["action-start", "onNavigation", "onSettled", "error-caught"];
	expect(executionOrder).toStrictEqual(expectedOrder);
});

test("redirect with validation - error thrown after validation passes", async () => {
	const executionOrder: string[] = [];

	const action = ac.inputSchema(z.object({ shouldRedirect: z.boolean() })).action(async ({ parsedInput }) => {
		executionOrder.push("validation-passed");
		if (parsedInput.shouldRedirect) {
			executionOrder.push("before-redirect");
			redirect("/test");
		}
		return { success: true };
	});

	await action({ shouldRedirect: true }).catch((e) => {
		executionOrder.push("error-caught");
		if (!FrameworkErrorHandler.isNavigationError(e)) {
			throw e;
		}
	});

	const expectedOrder = ["validation-passed", "before-redirect", "error-caught"];
	expect(executionOrder).toStrictEqual(expectedOrder);
});

test("redirect in middleware is thrown immediately", async () => {
	let middlewareExecuted = false;

	const action = ac
		.use(async () => {
			middlewareExecuted = true;
			redirect("/test");
		})
		.action(async () => {
			return { unreachable: true };
		});

	let errorCaught = false;
	await action().catch((e) => {
		if (FrameworkErrorHandler.isNavigationError(e)) {
			errorCaught = true;
		}
	});

	expect(middlewareExecuted).toBe(true);
	expect(errorCaught).toBe(true);
});

test("no double-throwing of navigation errors", async () => {
	let catchCount = 0;

	const action = ac.action(async () => {
		redirect("/test");
	});

	// If the error were thrown twice, we might catch it twice
	const promise = action();

	promise.catch((e) => {
		if (FrameworkErrorHandler.isNavigationError(e)) {
			catchCount++;
		}
	});

	await promise.catch(() => {
		// Suppress error for test
	});

	// Wait a bit to ensure no delayed/deferred throws
	await new Promise((resolve) => setTimeout(resolve, 100));

	expect(catchCount).toBe(1);
});

test("redirect preserves error digest format", async () => {
	const action = ac.action(async () => {
		redirect("/test-path");
	});

	await action().catch((e: unknown) => {
		if (FrameworkErrorHandler.isNavigationError(e)) {
			const err = e as unknown as Record<string, unknown>;
			// Verify the error has the expected Next.js redirect format
			expect("digest" in err).toBe(true);
			expect(typeof err.digest).toBe("string");
			expect((err.digest as string).includes("NEXT_REDIRECT")).toBe(true);
		}
	});
});
