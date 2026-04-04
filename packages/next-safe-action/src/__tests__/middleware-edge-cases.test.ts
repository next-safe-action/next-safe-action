import { expect, test } from "vitest";
import { z } from "zod";
import { createSafeActionClient } from "..";

const ac = createSafeActionClient({
	handleServerError(e) {
		return e.message;
	},
});

test("middleware that does not call next still returns a result", async () => {
	const action = ac
		// @ts-expect-error - intentionally not calling next() to test edge case behavior
		.use(async () => {
			// Intentionally not calling next().
		})
		.action(async () => {
			return { ok: true };
		});

	const actualResult = await action();
	const expectedResult = {};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("middleware that calls next twice throws an error", async () => {
	const action = ac
		.use(async ({ next }) => {
			await next();
			return next();
		})
		.action(async () => {
			return { ok: true };
		});

	const actualResult = await action();

	// Calling next() twice is guarded. The first call succeeds (data is set),
	// then the second call triggers a server error.
	expect(actualResult).toStrictEqual({
		data: { ok: true },
		serverError: "next() called multiple times in middleware. Each middleware must call next() at most once.",
	});
});

test("middleware receives correct clientInput and bindArgsClientInputs", async () => {
	let capturedClientInput: unknown;
	let capturedBindArgsClientInputs: unknown[] = [];

	const action = ac
		.inputSchema(z.object({ name: z.string().min(1) }))
		.bindArgsSchemas([z.object({ id: z.number() })])
		.use(async ({ clientInput, bindArgsClientInputs, next }) => {
			capturedClientInput = clientInput;
			capturedBindArgsClientInputs = bindArgsClientInputs;
			return next();
		})
		.action(async () => {
			return { ok: true };
		});

	const bindArg = { id: 42 };
	const mainInput = { name: "test" };
	await action(bindArg, mainInput);

	// Middleware receives the raw (unparsed) client inputs.
	expect(capturedClientInput).toStrictEqual(mainInput);
	expect(capturedBindArgsClientInputs).toStrictEqual([bindArg]);
});

test("deeply nested middleware chain preserves context order", async () => {
	const action = ac
		.use(async ({ next }) => {
			return next({ ctx: { a: 1 } });
		})
		.use(async ({ next }) => {
			return next({ ctx: { b: 2 } });
		})
		.use(async ({ next }) => {
			return next({ ctx: { c: 3 } });
		})
		.use(async ({ next }) => {
			return next({ ctx: { d: 4 } });
		})
		.use(async ({ next }) => {
			return next({ ctx: { e: 5 } });
		})
		.action(async ({ ctx }) => {
			return { ctx };
		});

	const actualResult = await action();
	const expectedResult = {
		data: {
			ctx: { a: 1, b: 2, c: 3, d: 4, e: 5 },
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("middleware error is caught and returned as serverError", async () => {
	const action = ac
		.use(async () => {
			throw new Error("middleware sync error");
		})
		.action(async () => {
			return { ok: true };
		});

	const actualResult = await action();
	const expectedResult = {
		serverError: "middleware sync error",
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("middleware async error is caught and returned as serverError", async () => {
	const action = ac
		.use(async () => {
			await Promise.resolve();
			throw new Error("middleware async error");
		})
		.action(async () => {
			return { ok: true };
		});

	const actualResult = await action();
	const expectedResult = {
		serverError: "middleware async error",
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

// ─── Deep merge behavior ─────────────────────────────────────────────

test("deep merge preserves nested properties from both middleware", async () => {
	const action = ac
		.use(async ({ next }) => {
			return next({ ctx: { config: { timeout: 5000, retries: 3 } } });
		})
		.use(async ({ next }) => {
			return next({ ctx: { config: { timeout: 10000 } } });
		})
		.action(async ({ ctx }) => {
			return { config: ctx.config };
		});

	const actualResult = await action();

	// deepmerge recursively merges nested objects: retries from first middleware survives,
	// timeout from second middleware wins.
	expect(actualResult).toStrictEqual({
		data: {
			config: { timeout: 10000, retries: 3 },
		},
	});
});

test("deep merge concatenates arrays in context", async () => {
	const action = ac
		.use(async ({ next }) => {
			return next({ ctx: { tags: ["auth"] } });
		})
		.use(async ({ next }) => {
			return next({ ctx: { tags: ["logging"] } });
		})
		.action(async ({ ctx }) => {
			return { tags: ctx.tags };
		});

	const actualResult = await action();

	// deepmerge-ts concatenates arrays by default.
	expect(actualResult).toStrictEqual({
		data: {
			tags: ["auth", "logging"],
		},
	});
});

test("deep merge handles deeply nested objects across three middleware", async () => {
	const action = ac
		.use(async ({ next }) => {
			return next({ ctx: { db: { pool: { min: 2 }, host: "localhost" } } });
		})
		.use(async ({ next }) => {
			return next({ ctx: { db: { pool: { max: 10 }, port: 5432 } } });
		})
		.use(async ({ next }) => {
			return next({ ctx: { db: { pool: { idleTimeout: 30000 } } } });
		})
		.action(async ({ ctx }) => {
			return { db: ctx.db };
		});

	const actualResult = await action();

	expect(actualResult).toStrictEqual({
		data: {
			db: {
				pool: { min: 2, max: 10, idleTimeout: 30000 },
				host: "localhost",
				port: 5432,
			},
		},
	});
});

// ─── Result inspection (onion model) ─────────────────────────────────

test("use() middleware inspects result after useValidated() and action run", async () => {
	let middlewareResult: unknown;

	const action = ac
		.use(async ({ next }) => {
			const res = await next();
			middlewareResult = res;
			return res;
		})
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(async ({ parsedInput, next }) => {
			return next({ ctx: { greeting: `hello ${parsedInput.name}` } });
		})
		.action(async () => {
			return { ok: true };
		});

	await action({ name: "world" });

	// middlewareResult.ctx reflects the final accumulated context from ALL middleware,
	// including useValidated(), because it's a single shared mutable object.
	expect(middlewareResult).toStrictEqual({
		success: true,
		ctx: { greeting: "hello world" },
		data: { ok: true },
		parsedInput: { name: "world" },
		bindArgsParsedInputs: [],
	});
});

test("use() middleware captures error result when useValidated() throws", async () => {
	let middlewareResult: unknown;

	const action = ac
		.use(async ({ next }) => {
			const res = await next();
			middlewareResult = res;
			return res;
		})
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(async () => {
			throw new Error("auth check failed");
		})
		.action(async () => {
			return { ok: true };
		});

	await action({ name: "test" });

	expect(middlewareResult).toStrictEqual({
		success: false,
		ctx: {},
		serverError: "auth check failed",
	});
});

test("use() middleware captures validation error result before useValidated() runs", async () => {
	let middlewareResult: unknown;
	let validatedCalled = false;

	const action = ac
		.use(async ({ next }) => {
			const res = await next();
			middlewareResult = res;
			return res;
		})
		.inputSchema(z.object({ name: z.string().min(5) }))
		.useValidated(async ({ next }) => {
			validatedCalled = true;
			return next();
		})
		.action(async () => {
			return { ok: true };
		});

	await action({ name: "ab" });

	expect(validatedCalled).toBe(false);
	expect(middlewareResult).toMatchObject({
		success: false,
		validationErrors: {
			name: {
				_errors: [expect.stringContaining("Too small")],
			},
		},
	});
});

// ─── Async schema with middleware ────────────────────────────────────

test("middleware works correctly with async inputSchema function", async () => {
	let capturedClientInput: unknown;

	const action = ac
		.use(async ({ clientInput, next }) => {
			capturedClientInput = clientInput;
			return next();
		})
		.inputSchema(async () => z.string().transform((s) => s.toUpperCase()))
		.action(async ({ parsedInput }) => {
			return { value: parsedInput };
		});

	const actualResult = await action("hello");

	// use() middleware always sees raw client input, not parsed.
	expect(capturedClientInput).toBe("hello");
	expect(actualResult).toStrictEqual({
		data: { value: "HELLO" },
	});
});

// ─── Middleware post-processing ──────────────────────────────────────

test("middleware can post-process after awaiting next()", async () => {
	const sideEffects: string[] = [];

	const action = ac
		.use(async ({ next }) => {
			sideEffects.push("before");
			const res = await next();
			sideEffects.push("after");
			return res;
		})
		.action(async () => {
			sideEffects.push("action");
			return { ok: true };
		});

	await action();

	expect(sideEffects).toStrictEqual(["before", "action", "after"]);
});

test("nested middleware post-processing runs in correct onion order", async () => {
	const sideEffects: string[] = [];

	const action = ac
		.use(async ({ next }) => {
			sideEffects.push("outer-before");
			const res = await next();
			sideEffects.push("outer-after");
			return res;
		})
		.use(async ({ next }) => {
			sideEffects.push("inner-before");
			const res = await next();
			sideEffects.push("inner-after");
			return res;
		})
		.action(async () => {
			sideEffects.push("action");
			return { ok: true };
		});

	await action();

	// Onion model: outer-before -> inner-before -> action -> inner-after -> outer-after
	expect(sideEffects).toStrictEqual(["outer-before", "inner-before", "action", "inner-after", "outer-after"]);
});

// ─── Chain completion guard ──────────────────────────────────────────

test("use() middleware calling stored next() after chain completed throws", async () => {
	let storedNext: (() => Promise<unknown>) | null = null;

	const action = ac
		// @ts-expect-error - intentionally not returning a result to test guard behavior
		.use(async ({ next }) => {
			storedNext = next;
			// Intentionally not calling next(), so the chain short-circuits.
		})
		.action(async () => {
			return { ok: true };
		});

	await action();

	// The chain has completed. Calling the stored next() should throw.
	expect(storedNext).not.toBeNull();
	await expect(storedNext!()).rejects.toThrow(
		"next() called after the middleware chain has already completed."
	);
});

test("useValidated() middleware calling stored next() after chain completed throws", async () => {
	let storedNext: (() => Promise<unknown>) | null = null;

	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		// @ts-expect-error - intentionally not returning a result to test guard behavior
		.useValidated(async ({ next }) => {
			storedNext = next;
			// Intentionally not calling next(), so the chain short-circuits.
		})
		.action(async () => {
			return { ok: true };
		});

	await action({ name: "test" });

	// The chain has completed. Calling the stored next() should throw.
	expect(storedNext).not.toBeNull();
	await expect(storedNext!()).rejects.toThrow(
		"next() called after the middleware chain has already completed."
	);
});

test("use() middleware calling next() normally still works (chain completion guard does not interfere)", async () => {
	const order: string[] = [];

	const action = ac
		.use(async ({ next }) => {
			order.push("before");
			const res = await next();
			order.push("after");
			return res;
		})
		.action(async () => {
			order.push("action");
			return { ok: true };
		});

	const result = await action();

	expect(result).toStrictEqual({ data: { ok: true } });
	expect(order).toStrictEqual(["before", "action", "after"]);
});

test("stored next() from use() that was called once cannot be called again after chain completion", async () => {
	let storedNext: (() => Promise<unknown>) | null = null;

	const action = ac
		.use(async ({ next }) => {
			storedNext = next;
			const res = await next();
			return res;
		})
		.action(async () => {
			return { ok: true };
		});

	const result = await action();
	expect(result).toStrictEqual({ data: { ok: true } });

	// next() was already called once during normal execution.
	// Calling it again after chain completion hits the chain completion guard first,
	// since chainCompleted is checked before nextCalled.
	expect(storedNext).not.toBeNull();
	await expect(storedNext!()).rejects.toThrow(
		"next() called after the middleware chain has already completed."
	);
});
