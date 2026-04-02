import { redirect } from "next/navigation";
import { expect, test } from "vitest";
import { z } from "zod";
import { createSafeActionClient, createValidatedMiddleware } from "..";
import { FrameworkErrorHandler } from "../next/errors";

const ac = createSafeActionClient({
	handleServerError(e) {
		return {
			message: e.message,
		};
	},
}).use(async ({ next }) => {
	return next({ ctx: { foo: "bar" } });
});

test("useValidated middleware receives parsed input after validation", async () => {
	let capturedParsedInput: unknown;

	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(async ({ parsedInput, next }) => {
			capturedParsedInput = parsedInput;
			return next();
		})
		.action(async () => {
			return { ok: true };
		});

	const actualResult = await action({ name: "test" });
	const expectedResult = {
		data: { ok: true },
	};

	expect(actualResult).toStrictEqual(expectedResult);
	expect(capturedParsedInput).toStrictEqual({ name: "test" });
});

test("useValidated middleware receives typed client input", async () => {
	let capturedClientInput: unknown;

	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(async ({ clientInput, next }) => {
			capturedClientInput = clientInput;
			return next();
		})
		.action(async () => {
			return { ok: true };
		});

	await action({ name: "test" });

	expect(capturedClientInput).toStrictEqual({ name: "test" });
});

test("useValidated middleware receives bind args parsed inputs", async () => {
	let capturedBindArgsParsedInputs: unknown;
	let capturedBindArgsClientInputs: unknown;

	const action = ac
		.inputSchema(z.string())
		.bindArgsSchemas([z.number()])
		.useValidated(async ({ bindArgsParsedInputs, bindArgsClientInputs, next }) => {
			capturedBindArgsParsedInputs = bindArgsParsedInputs;
			capturedBindArgsClientInputs = bindArgsClientInputs;
			return next();
		})
		.action(async () => {
			return { ok: true };
		});

	const actualResult = await action(42, "hello");
	const expectedResult = {
		data: { ok: true },
	};

	expect(actualResult).toStrictEqual(expectedResult);
	expect(capturedBindArgsParsedInputs).toStrictEqual([42]);
	expect(capturedBindArgsClientInputs).toStrictEqual([42]);
});

test("useValidated middleware extends context via next", async () => {
	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(async ({ next }) => {
			return next({ ctx: { validated: true } });
		})
		.action(async ({ ctx }) => {
			return { validated: ctx.validated };
		});

	const actualResult = await action({ name: "test" });
	const expectedResult = {
		data: { validated: true },
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("multiple useValidated middleware accumulate context in order", async () => {
	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(async ({ next }) => {
			return next({ ctx: { first: "one" } });
		})
		.useValidated(async ({ next }) => {
			return next({ ctx: { second: "two" } });
		})
		.action(async ({ ctx }) => {
			return { first: ctx.first, second: ctx.second };
		});

	const actualResult = await action({ name: "test" });
	const expectedResult = {
		data: { first: "one", second: "two" },
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("use() middleware runs before useValidated middleware", async () => {
	const order: string[] = [];

	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		.use(async ({ next }) => {
			order.push("use");
			return next();
		})
		.useValidated(async ({ next }) => {
			order.push("validated");
			return next();
		})
		.action(async () => {
			order.push("action");
			return { ok: true };
		});

	await action({ name: "test" });

	expect(order).toStrictEqual(["use", "validated", "action"]);
});

test("use() after useValidated still runs before validation", async () => {
	const order: string[] = [];

	const acWithTracking = createSafeActionClient({
		handleServerError(e) {
			return { message: e.message };
		},
	}).use(async ({ next }) => {
		order.push("use-base");
		return next({ ctx: { foo: "bar" } });
	});

	const action = acWithTracking
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(async ({ next }) => {
			order.push("validated");
			return next();
		})
		.use(async ({ next }) => {
			order.push("use-after");
			return next();
		})
		.action(async () => {
			order.push("action");
			return { ok: true };
		});

	await action({ name: "test" });

	expect(order).toStrictEqual(["use-base", "use-after", "validated", "action"]);
});

test("useValidated middleware NOT called when main input validation fails", async () => {
	let validatedMiddlewareCalled = false;

	const action = ac
		.inputSchema(z.object({ name: z.string().min(3) }))
		.useValidated(async ({ next }) => {
			validatedMiddlewareCalled = true;
			return next();
		})
		.action(async () => {
			return { ok: true };
		});

	const actualResult = await action({ name: "" });

	expect(validatedMiddlewareCalled).toBe(false);
	expect(actualResult).toHaveProperty("validationErrors");
});

test("useValidated middleware NOT called when bind args validation fails", async () => {
	let validatedMiddlewareCalled = false;

	const action = ac
		.inputSchema(z.string())
		.bindArgsSchemas([z.number().min(10)])
		.useValidated(async ({ next }) => {
			validatedMiddlewareCalled = true;
			return next();
		})
		.action(async () => {
			return { ok: true };
		});

	const actualResult = await action(5, "hello");

	expect(validatedMiddlewareCalled).toBe(false);
	expect(actualResult).toHaveProperty("serverError");
});

test("useValidated middleware receives correct values after schema transforms", async () => {
	let capturedClientInput: unknown;
	let capturedParsedInput: unknown;

	const action = ac
		.inputSchema(z.string().transform((s) => s.toUpperCase()))
		.useValidated(async ({ clientInput, parsedInput, next }) => {
			capturedClientInput = clientInput;
			capturedParsedInput = parsedInput;
			return next();
		})
		.action(async () => {
			return { ok: true };
		});

	await action("hello");

	expect(capturedClientInput).toBe("hello");
	expect(capturedParsedInput).toBe("HELLO");
});

test("useValidated middleware error propagates as serverError", async () => {
	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(async () => {
			throw new Error("validated error");
		})
		.action(async () => {
			return { ok: true };
		});

	const actualResult = await action({ name: "test" });
	const expectedResult = {
		serverError: { message: "validated error" },
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("useValidated middleware framework error (redirect) propagates", async () => {
	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(async () => {
			redirect("/foo");
		})
		.action(async () => {
			return { ok: true };
		});

	try {
		await action({ name: "test" });
		expect.unreachable("Expected a framework error to be thrown");
	} catch (e) {
		expect(FrameworkErrorHandler.isNavigationError(e)).toBe(true);
	}
});

test("useValidated middleware next() called multiple times returns error", async () => {
	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(async ({ next }) => {
			await next();
			return next();
		})
		.action(async () => {
			return { ok: true };
		});

	const actualResult = await action({ name: "test" });

	expect(actualResult).toStrictEqual({
		data: { ok: true },
		serverError: {
			message: "next() called multiple times in middleware. Each middleware must call next() at most once.",
		},
	});
});

test("useValidated middleware not calling next returns empty result", async () => {
	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		// @ts-expect-error - intentionally not calling next() to test edge case behavior
		.useValidated(async () => {
			// Intentionally not calling next().
		})
		.action(async () => {
			return { ok: true };
		});

	const actualResult = await action({ name: "test" });
	const expectedResult = {};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("context from use() is available in useValidated middleware", async () => {
	let capturedCtx: unknown;

	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(async ({ ctx, next }) => {
			capturedCtx = ctx;
			return next();
		})
		.action(async () => {
			return { ok: true };
		});

	await action({ name: "test" });

	expect(capturedCtx).toStrictEqual({ foo: "bar" });
});

test("context from useValidated is available in server code", async () => {
	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(async ({ next }) => {
			return next({ ctx: { userId: "123" } });
		})
		.action(async ({ ctx }) => {
			return { userId: ctx.userId };
		});

	const actualResult = await action({ name: "test" });
	const expectedResult = {
		data: { userId: "123" },
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("createValidatedMiddleware standalone middleware works", async () => {
	const standaloneMiddleware = createValidatedMiddleware<{ parsedInput: { name: string } }>().define(
		async ({ parsedInput, next }) => {
			return next({ ctx: { greeting: `hello ${parsedInput.name}` } });
		}
	);

	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(standaloneMiddleware)
		.action(async ({ ctx }) => {
			return { greeting: ctx.greeting };
		});

	const actualResult = await action({ name: "world" });
	const expectedResult = {
		data: { greeting: "hello world" },
	};

	expect(actualResult).toStrictEqual(expectedResult);
});
