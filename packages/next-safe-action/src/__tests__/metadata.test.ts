import { expect, test } from "vitest";
import { z } from "zod";
import { DEFAULT_SERVER_ERROR_MESSAGE, createSafeActionClient } from "..";
import { ActionMetadataValidationError } from "../validation-errors";

const ac = createSafeActionClient({
	handleServerError: () => DEFAULT_SERVER_ERROR_MESSAGE, // disable server errors logging for these tests
	defineMetadataSchema() {
		return z.object({
			actionName: z.string(),
		});
	},
});

test("action with expected metadata format works", async () => {
	const md = { actionName: "testAction" };
	const action = ac.metadata(md).action(async ({ metadata }) => {
		return {
			metadata,
		};
	});

	const actualResult = await action();
	const expectedResult = {
		data: {
			metadata: md,
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action without expected metadata returns server error", async () => {
	// @ts-expect-error
	const action = ac.action(async ({ metadata }) => {
		return {
			metadata,
		};
	});

	const actualResult = await action();
	const expectedResult = {
		serverError: DEFAULT_SERVER_ERROR_MESSAGE,
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("metadata is passed to middleware functions and server code function", async () => {
	const md = { actionName: "testAction" };

	const action = ac
		.use(async ({ metadata, next }) => {
			return next({ ctx: { md1: metadata } });
		})
		.use(async ({ metadata, next, ctx }) => {
			return next({ ctx: { ...ctx, md2: metadata } });
		})
		.metadata(md)
		.action(async ({ metadata: md3, ctx: { md1, md2 } }) => {
			return {
				md1,
				md2,
				md3,
			};
		});

	const actualResult = await action();

	const expectedResult = {
		data: {
			md1: md,
			md2: md,
			md3: md,
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with invalid metadata type returns server error", async () => {
	// @ts-expect-error
	const action = ac.metadata({ actionName: 123 }).action(async ({ metadata }) => {
		return {
			metadata,
		};
	});

	const actualResult = await action();
	const expectedResult = {
		serverError: DEFAULT_SERVER_ERROR_MESSAGE,
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("ActionMetadataValidationError is thrown for invalid metadata when throwServerError is true", async () => {
	const rethrowClient = createSafeActionClient({
		handleServerError(e) {
			throw e;
		},
		defineMetadataSchema() {
			return z.object({
				actionName: z.string(),
			});
		},
	});

	// @ts-expect-error
	const action = rethrowClient.metadata({ actionName: 123 }).action(async () => {
		return { ok: true };
	});

	await expect(() => action()).rejects.toThrow(ActionMetadataValidationError);

	try {
		await action();
	} catch (e) {
		expect(e).toBeInstanceOf(ActionMetadataValidationError);
		expect((e as ActionMetadataValidationError<any>).validationErrors).toBeDefined();
	}
});

test("action with metadata schema and input schema validates both", async () => {
	const action = ac
		.metadata({ actionName: "testAction" })
		.inputSchema(z.object({ username: z.string().min(3) }))
		.action(async ({ parsedInput }) => {
			return {
				username: parsedInput.username,
			};
		});

	// Valid metadata, invalid input.
	const actualResult = await action({ username: "ab" });

	expect(actualResult).not.toHaveProperty("serverError");
	expect(actualResult).toHaveProperty("validationErrors");
});

test("action with metadata schema and input schema, invalid metadata takes precedence", async () => {
	const action = ac
		// @ts-expect-error - intentionally passing invalid metadata type
		.metadata({ actionName: 123 })
		.inputSchema(z.object({ username: z.string().min(3) }))
		.action(async ({ parsedInput }) => {
			return {
				username: parsedInput.username,
			};
		});

	// Invalid metadata + invalid input. Metadata validation fails first (before input validation).
	const actualResult = await action({ username: "ab" });

	expect(actualResult).toHaveProperty("serverError", DEFAULT_SERVER_ERROR_MESSAGE);
});
