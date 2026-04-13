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

test("action with all valid bind args and valid main input returns data", async () => {
	const schema = z.object({
		username: z.string().min(3),
	});

	const bindArgsSchemas: [age: z.ZodNumber, userId: z.ZodString] = [z.number().positive(), z.string().uuid()];

	const action = dac
		.inputSchema(schema)
		.bindArgsSchemas(bindArgsSchemas)
		.action(async ({ parsedInput, bindArgsParsedInputs }) => {
			return {
				username: parsedInput.username,
				age: bindArgsParsedInputs[0],
				userId: bindArgsParsedInputs[1],
			};
		});

	const userId = crypto.randomUUID();
	const actualResult = await action(25, userId, { username: "johndoe" });

	const expectedResult = {
		data: {
			username: "johndoe",
			age: 25,
			userId,
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with some valid and some invalid bind args returns server error with correct positions", async () => {
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

	// First arg valid, second arg invalid, third arg valid.
	const actualResult = await action(5, "not-a-uuid", { id: crypto.randomUUID() });

	const expectedResult = {
		serverError: {
			bindArgsValidationErrors: [
				{},
				{
					_errors: ["Invalid UUID"],
				},
				{},
			],
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with invalid bind args and invalid main input reports main input errors (precedence)", async () => {
	const schema = z.object({
		username: z.string().min(3),
	});

	const bindArgsSchemas: [age: z.ZodNumber] = [z.number().positive()];

	const action = uac
		.inputSchema(schema)
		.bindArgsSchemas(bindArgsSchemas)
		.action(async () => {
			return {
				ok: true,
			};
		});

	// Invalid bind arg (-1 is not positive) and invalid main input ("ab" is less than 3 chars).
	const actualResult = await action(-1, { username: "ab" });

	// The result precedence rule (validationErrors > serverError > data) means
	// main input validation errors take precedence over bind args errors (which
	// are wrapped as serverError). After the user fixes the main input and
	// resubmits, they will see the bind args errors.
	expect(actualResult).not.toHaveProperty("serverError");
	expect(actualResult).toHaveProperty("validationErrors");
	expect((actualResult as any).validationErrors).toHaveProperty("username");
});

test("throwServerError does not override validationErrors precedence in compound state", async () => {
	// Regression test: when bind args validation fails (wrapped as serverError)
	// AND main input validation fails (validationErrors) AND the action opts
	// into `throwServerError: true`, the action must NOT throw the wrapped bind
	// args server error. The advertised precedence (validationErrors > serverError)
	// has to be honored in the throwing path too, otherwise users lose the
	// actionable field errors they were trying to surface.
	const schema = z.object({
		username: z.string().min(3),
	});

	const bindArgsSchemas: [age: z.ZodNumber] = [z.number().positive()];

	const action = uac
		.inputSchema(schema)
		.bindArgsSchemas(bindArgsSchemas)
		.action(
			async () => {
				return { ok: true };
			},
			{ throwServerError: true }
		);

	// Invalid bind arg AND invalid main input, with throwServerError enabled.
	const actualResult = await action(-1, { username: "ab" });

	// The action should NOT throw — it should return a result with validationErrors.
	expect(actualResult).not.toHaveProperty("serverError");
	expect(actualResult).not.toHaveProperty("data");
	expect(actualResult).toHaveProperty("validationErrors");
	expect((actualResult as any).validationErrors).toHaveProperty("username");
});
