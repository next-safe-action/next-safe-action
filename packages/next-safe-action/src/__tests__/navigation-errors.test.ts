import { notFound, redirect } from "next/navigation";
import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { createSafeActionClient, type MiddlewareResult, returnServerError, returnValidationErrors } from "..";
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

test("navigation error discards any pre-populated result (onSettled receives empty result)", async () => {
	// Regression guard for the precedence at `buildResultAndRunCallbacks` in
	// `action-builder.ts`: a framework navigation error at any stage short-circuits
	// the result to `{}` before any data accumulated during the run can leak into
	// `onSettled`. We construct a compound state where the inner action succeeds
	// (populating `middlewareResult.data`) and then an outer middleware throws a
	// redirect during post-processing — onSettled must still see `result: {}`.
	let onSettledResult: unknown;
	let innerData: unknown;

	const action = ac
		.use(async ({ next }) => {
			const res = await next();
			// Inner action succeeded; its data is observable here, confirming the
			// setup is valid — the inner `next()` did populate `data`.
			innerData = (res as { data?: unknown }).data;
			redirect("/after-success");
		})
		.action(
			async () => {
				return { inner: "ran to completion" };
			},
			{
				onSettled: async ({ result }) => {
					onSettledResult = result;
				},
			}
		);

	await action().catch((e) => {
		if (!FrameworkErrorHandler.isNavigationError(e)) {
			throw e;
		}
	});

	// Inner action data DID exist mid-flight — middleware saw it.
	expect(innerData).toEqual({ inner: "ran to completion" });
	// But onSettled received the idle shape, not the partial success.
	expect(onSettledResult).toStrictEqual({});
});

// ─── Middleware errors after `next()` replace a pending navigation (#488) ──────

describe("middleware error after next() replaces a pending navigation", () => {
	const client = createSafeActionClient({
		handleServerError: (e) => e.message,
	});

	test("thrown error becomes the server error and the redirect is dropped", async () => {
		const onNavigation = vi.fn();
		const onError = vi.fn();
		const onSettled = vi.fn();
		let seenNavigationKind: unknown;

		const action = client
			.use(async ({ next }) => {
				const res = await next();
				seenNavigationKind = res.navigationKind;
				throw new Error("commit failed");
			})
			.action(
				async () => {
					redirect("/done");
				},
				{ onNavigation, onError, onSettled }
			);

		const result = await action();

		expect(seenNavigationKind).toBe("redirect");
		expect(result).toStrictEqual({ serverError: "commit failed" });
		expect(onNavigation).not.toHaveBeenCalled();
		expect(onError).toHaveBeenCalledWith(expect.objectContaining({ error: { serverError: "commit failed" } }));
		expect(onSettled).toHaveBeenCalledWith(expect.objectContaining({ result: { serverError: "commit failed" } }));
		expect(onSettled.mock.calls[0]?.[0]).not.toHaveProperty("navigationKind");
	});

	test("returnServerError() after next() drops the redirect", async () => {
		const action = createSafeActionClient()
			.use(async ({ next }) => {
				await next();
				returnServerError("not saved");
			})
			.action(async () => {
				redirect("/done");
			});

		expect(await action()).toStrictEqual({ serverError: "not saved" });
	});

	test("returnValidationErrors() after next() drops the redirect", async () => {
		const schema = z.object({ name: z.string() });

		const action = client
			.inputSchema(schema)
			.use(async ({ next }) => {
				await next();
				returnValidationErrors(schema, { name: { _errors: ["taken"] } });
			})
			.action(async () => {
				redirect("/done");
			});

		expect(await action({ name: "x" })).toStrictEqual({ validationErrors: { name: { _errors: ["taken"] } } });
	});

	test("notFound() is dropped the same way", async () => {
		const action = client
			.use(async ({ next }) => {
				await next();
				throw new Error("commit failed");
			})
			.action(async () => {
				notFound();
			});

		expect(await action()).toStrictEqual({ serverError: "commit failed" });
	});

	test("validated middleware error after next() drops the redirect", async () => {
		const action = client
			.inputSchema(z.object({ id: z.string() }))
			.useValidated(async ({ next }) => {
				await next();
				throw new Error("commit failed");
			})
			.action(async () => {
				redirect("/done");
			});

		expect(await action({ id: "1" })).toStrictEqual({ serverError: "commit failed" });
	});

	test("outer middleware sees the error, not the navigation", async () => {
		let outerResult: MiddlewareResult<string, object> | undefined;

		const action = client
			.use(async ({ next }) => {
				const res = await next();
				outerResult = res;
				return res;
			})
			.use(async ({ next }) => {
				await next();
				throw new Error("commit failed");
			})
			.action(async () => {
				redirect("/done");
			});

		expect(await action()).toStrictEqual({ serverError: "commit failed" });
		expect(outerResult?.success).toBe(false);
		expect(outerResult?.navigationKind).toBeUndefined();
		expect(outerResult?.serverError).toBe("commit failed");
	});

	test("a navigation raised by the middleware after next() still wins", async () => {
		const action = client
			.use(async ({ next }) => {
				await next();
				redirect("/error");
			})
			.action(async () => {
				redirect("/done");
			});

		await expect(action()).rejects.toMatchObject({ digest: expect.stringContaining(";/error;") });
	});

	test("a middleware that only reads the result keeps the redirect", async () => {
		const action = client
			.use(async ({ next }) => {
				return next();
			})
			.action(async () => {
				redirect("/done");
			});

		await expect(action()).rejects.toMatchObject({ digest: expect.stringContaining(";/done;") });
	});
});
