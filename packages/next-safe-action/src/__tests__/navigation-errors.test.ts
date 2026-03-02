import { redirect } from "next/navigation";
import { expect, test } from "vitest";
import { z } from "zod";
import { createSafeActionClient, type MiddlewareResult } from "..";
import { FrameworkErrorHandler } from "../next/errors";

const ac = createSafeActionClient();

test("action with redirect throws navigation error immediately on server", async () => {
	const action = ac.action(async () => {
		redirect("/test");
	});

	try {
		await action();
		expect.unreachable("Expected navigation error to be thrown");
	} catch (e) {
		expect(FrameworkErrorHandler.isNavigationError(e)).toBe(true);
	}
});

test("action with redirect includes onNavigation callback execution before throwing", async () => {
	let onNavigationCalled = false;
	let onSettledCalled = false;

	const action = ac.action(
		async () => {
			redirect("/test");
		},
		{
			onNavigation: async ({ navigationKind }) => {
				onNavigationCalled = true;
				expect(navigationKind).toBe("redirect");
			},
			onSettled: async ({ navigationKind }) => {
				onSettledCalled = true;
				expect(navigationKind).toBe("redirect");
			},
		}
	);

	await action().catch((e) => {
		if (!FrameworkErrorHandler.isNavigationError(e)) {
			throw e;
		}
	});

	expect(onNavigationCalled).toBe(true);
	expect(onSettledCalled).toBe(true);
});

test("action with redirect does not call onSuccess or onError callbacks", async () => {
	let onSuccessCalled = false;
	let onErrorCalled = false;

	const action = ac.action(
		async () => {
			redirect("/test");
		},
		{
			onSuccess: async () => {
				onSuccessCalled = true;
			},
			onError: async () => {
				onErrorCalled = true;
			},
		}
	);

	await action().catch((e) => {
		if (!FrameworkErrorHandler.isNavigationError(e)) {
			throw e;
		}
	});

	expect(onSuccessCalled).toBe(false);
	expect(onErrorCalled).toBe(false);
});

test("action with input schema and redirect calls onNavigation callback with correct navigation kind", async () => {
	let onNavigationCalled = false;
	let capturedNavigationKind: any;
	const testInput = { userId: "test-123", action: "redirect" };

	const action = ac.inputSchema(z.object({ userId: z.string(), action: z.string() })).action(
		async ({ parsedInput }) => {
			if (parsedInput.action === "redirect") {
				redirect("/dashboard");
			}
			return { success: true };
		},
		{
			onNavigation: async ({ navigationKind }) => {
				onNavigationCalled = true;
				capturedNavigationKind = navigationKind;
			},
		}
	);

	await action(testInput).catch((e) => {
		if (!FrameworkErrorHandler.isNavigationError(e)) {
			throw e;
		}
	});

	expect(onNavigationCalled).toBe(true);
	expect(capturedNavigationKind).toBe("redirect");
});

test("action correctly identifies different navigation types", async () => {
	const redirectAction = ac.action(async () => {
		redirect("/test");
	});

	await redirectAction().catch((e) => {
		if (!FrameworkErrorHandler.isNavigationError(e)) {
			throw e;
		}
		const kind = FrameworkErrorHandler.getNavigationKind(e);
		expect(kind).toBe("redirect");
	});
});

test("navigation error is thrown after middleware execution", async () => {
	let middlewareExecuted = false;
	let middlewareResult = {} as MiddlewareResult<any, any>;

	const action = ac
		.use(async ({ next }) => {
			middlewareExecuted = true;
			const res = await next();
			middlewareResult = res;
			return res;
		})
		.action(async () => {
			redirect("/test");
		});

	await action().catch((e) => {
		if (!FrameworkErrorHandler.isNavigationError(e)) {
			throw e;
		}
	});

	expect(middlewareExecuted).toBe(true);
	expect(middlewareResult.success).toBe(false);
	expect(middlewareResult.navigationKind).toBe("redirect");
});

test("redirect with bind args triggers onNavigation callback", async () => {
	let onNavigationCalled = false;
	let capturedNavigationKind: any;

	const action = ac
		.bindArgsSchemas<[userId: z.ZodString]>([z.string().uuid()])
		.inputSchema(z.object({ action: z.string() }))
		.action(
			async () => {
				redirect("/test");
			},
			{
				onNavigation: async ({ navigationKind }) => {
					onNavigationCalled = true;
					capturedNavigationKind = navigationKind;
				},
			}
		);

	const userId = "ed6f5b84-6bca-4d01-9a51-c3d0c49a7996";
	const input = { action: "redirect" };

	await action(userId, input).catch((e) => {
		if (!FrameworkErrorHandler.isNavigationError(e)) {
			throw e;
		}
	});

	expect(onNavigationCalled).toBe(true);
	expect(capturedNavigationKind).toBe("redirect");
});

test("multiple redirects in sequence each throw navigation error", async () => {
	let redirectCount = 0;

	const action1 = ac.action(async () => {
		redirect("/path1");
	});

	const action2 = ac.action(async () => {
		redirect("/path2");
	});

	await action1().catch((e) => {
		if (FrameworkErrorHandler.isNavigationError(e)) {
			redirectCount++;
		}
	});

	await action2().catch((e) => {
		if (FrameworkErrorHandler.isNavigationError(e)) {
			redirectCount++;
		}
	});

	expect(redirectCount).toBe(2);
});
