import { expect, test } from "vitest";
import { z } from "zod";
import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from "..";
import { ActionBindArgsValidationError } from "../validation-errors";

// Default client tests.

const dac = createSafeActionClient();

test("action with invalid bind args input and valid main input gives back a server error", async () => {
	const schema = z.object({
		username: z.string().min(3),
	});

	const bindArgsSchemas: [age: z.ZodNumber, userId: z.ZodString, product: z.ZodObject<{ id: z.ZodString }>] = [
		z.number().positive(),
		z.string().uuid(),
		z.object({
			id: z.string().uuid(),
		}),
	];

	const action = dac
		.inputSchema(schema)
		.bindArgsSchemas(bindArgsSchemas)
		.action(async () => {
			return {
				ok: true,
			};
		});

	const actualResult = await action(-123, crypto.randomUUID(), { id: "invalid_uuid" }, { username: "johndoe" });

	const expectedResult = {
		serverError: DEFAULT_SERVER_ERROR_MESSAGE,
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

// Unmasked server error client.

const uac = createSafeActionClient({
	handleServerError(error) {
		if (error instanceof ActionBindArgsValidationError) {
			return {
				bindArgsValidationErrors: error.validationErrors,
			};
		}

		return {
			message: error.message,
		};
	},
});

test("action with invalid bind args input gives back a server error object with correct `bindArgsValidationErrors` property", async () => {
	const bindArgsSchemas: [age: z.ZodNumber, userId: z.ZodString, product: z.ZodObject<{ id: z.ZodString }>] = [
		z.number().positive(),
		z.string().uuid(),
		z.object({
			id: z.string().uuid(),
		}),
	];

	const action = uac.bindArgsSchemas(bindArgsSchemas).action(async () => {
		return {
			ok: true,
		};
	});

	const actualResult = await action(-123, crypto.randomUUID(), { id: "invalid_uuid" });

	const expectedResult = {
		serverError: {
			bindArgsValidationErrors: [
				{
					_errors: ["Too small: expected number to be >0"],
				},
				{},
				{
					id: {
						_errors: ["Invalid UUID"],
					},
				},
			],
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});
