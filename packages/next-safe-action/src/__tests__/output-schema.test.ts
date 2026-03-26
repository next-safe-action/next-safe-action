import { expect, test } from "vitest";
import { z } from "zod";
import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from "..";
import { ActionOutputDataValidationError } from "../validation-errors";

test("action with valid output matching schema returns data", async () => {
	const ac = createSafeActionClient();

	const action = ac
		.outputSchema(z.object({ id: z.string(), name: z.string() }))
		.action(async () => {
			return {
				id: "123",
				name: "John",
			};
		});

	const actualResult = await action();

	const expectedResult = {
		data: {
			id: "123",
			name: "John",
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with invalid output returns serverError", async () => {
	const ac = createSafeActionClient({
		handleServerError: () => DEFAULT_SERVER_ERROR_MESSAGE,
	});

	const action = ac
		.outputSchema(z.object({ id: z.string() }))
		.action(async () => {
			return {
				id: 123 as unknown as string,
			};
		});

	const actualResult = await action();

	const expectedResult = {
		serverError: DEFAULT_SERVER_ERROR_MESSAGE,
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with outputSchema throws ActionOutputDataValidationError when throwServerError is true", async () => {
	const ac = createSafeActionClient({
		handleServerError: (e) => {
			// rethrow to preserve the original error type
			throw e;
		},
	});

	const outputSchema = z.object({ id: z.string() });

	const action = ac.outputSchema(outputSchema).action(
		async () => {
			return {
				id: 123 as unknown as string,
			};
		},
		{ throwServerError: true }
	);

	let thrownError: unknown;

	try {
		await action();
	} catch (e) {
		thrownError = e;
	}

	expect(thrownError).toBeInstanceOf(ActionOutputDataValidationError);

	const validationError = thrownError as ActionOutputDataValidationError<typeof outputSchema>;

	expect(validationError.validationErrors).toStrictEqual({
		id: {
			_errors: ["Invalid input: expected string, received number"],
		},
	});
});

test("action with valid output and inputSchema works", async () => {
	const ac = createSafeActionClient();

	const userId = "ed6f5b84-6bca-4d01-9a51-c3d0c49a7996";

	const action = ac
		.inputSchema(z.object({ userId: z.string().uuid() }))
		.outputSchema(z.object({ userId: z.string() }))
		.action(async ({ parsedInput }) => {
			return {
				userId: parsedInput.userId,
			};
		});

	const actualResult = await action({ userId });

	const expectedResult = {
		data: {
			userId,
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with no return value and outputSchema returns serverError", async () => {
	const ac = createSafeActionClient({
		handleServerError: () => DEFAULT_SERVER_ERROR_MESSAGE,
	});

	const action = ac
		.outputSchema(z.object({ id: z.string() }))
		.action(async () => {
			return undefined as unknown as { id: string };
		});

	const actualResult = await action();

	const expectedResult = {
		serverError: DEFAULT_SERVER_ERROR_MESSAGE,
	};

	expect(actualResult).toStrictEqual(expectedResult);
});
