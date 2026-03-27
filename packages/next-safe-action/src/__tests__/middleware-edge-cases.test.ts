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
