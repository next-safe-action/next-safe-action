import { expect, test } from "vitest";
import { z } from "zod";
import { createSafeActionClient } from "..";

const ac = createSafeActionClient();

test("action with no input schema returns empty object", async () => {
	const action = ac.action(async () => {
		return;
	});

	const actualResult = await action();
	const expectedResult = {};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with no input schema and return data gives back an object with correct `data`", async () => {
	const action = ac.action(async () => {
		return {
			ok: true,
		};
	});

	const actualResult = await action();
	const expectedResult = {
		data: {
			ok: true,
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with input, output schema and return data gives back an object with correct `data`", async () => {
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

test("action with input schema passed via async function and return data gives back an object with correct `data`", async () => {
	const userId = "ed6f5b84-6bca-4d01-9a51-c3d0c49a7996";

	const action = ac
		.inputSchema(async () => z.object({ userId: z.string().uuid() }))
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

test("action with input schema extended via async function, ouput schema and return data gives back an object with correct `data`", async () => {
	const userId = "ed6f5b84-6bca-4d01-9a51-c3d0c49a7996";
	const password = "password";

	const action = ac
		.inputSchema(z.object({ password: z.string() }))
		.inputSchema(async (prevSchema) => prevSchema.extend({ userId: z.string().uuid() }))
		.outputSchema(z.object({ userId: z.string(), password: z.string() }))
		.action(async ({ parsedInput }) => {
			return {
				userId: parsedInput.userId,
				password: parsedInput.password,
			};
		});

	const actualResult = await action({ password, userId });

	const expectedResult = {
		data: {
			password,
			userId,
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with no input schema, with bind args input schemas, output schema and return data gives back an object with correct `data`", async () => {
	const username = "johndoe";
	const age = 30;

	const action = ac
		.bindArgsSchemas<[username: z.ZodString, age: z.ZodNumber]>([z.string(), z.number()])
		.outputSchema(z.object({ username: z.string(), age: z.number() }))
		.action(async ({ bindArgsParsedInputs: [username, age] }) => {
			return {
				username,
				age,
			};
		});

	const actualResult = await action(username, age);

	const expectedResult = {
		data: {
			username,
			age,
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with input schema, bind args input schemas, output schema and return data gives back an object with correct `data`", async () => {
	const userId = "ed6f5b84-6bca-4d01-9a51-c3d0c49a7996";
	const username = "johndoe";
	const age = 30;

	const action = ac
		.inputSchema(z.object({ userId: z.string().uuid() }))
		.bindArgsSchemas<[username: z.ZodString, age: z.ZodNumber]>([z.string(), z.number()])
		.outputSchema(z.object({ userId: z.string(), username: z.string(), age: z.number() }))
		.action(async ({ parsedInput, bindArgsParsedInputs: [username, age] }) => {
			return {
				userId: parsedInput.userId,
				username,
				age,
			};
		});

	const actualResult = await action(username, age, { userId });

	const expectedResult = {
		data: {
			username,
			age,
			userId,
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

// Excess arguments tests: wrapper should not change the intended signature of the action.
// Extra arguments beyond what schemas define should be silently ignored.

test("action with no input schema silently ignores excess arguments", async () => {
	const action = ac.action(async () => {
		return {
			ok: true,
		};
	});

	const actionWithExcessArgs = action as (...args: unknown[]) => Promise<unknown>;
	const actualResult = await actionWithExcessArgs("extraneous", "malicious", "deadbeef");
	const expectedResult = {
		data: {
			ok: true,
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with input schema silently ignores excess arguments", async () => {
	const userId = "ed6f5b84-6bca-4d01-9a51-c3d0c49a7996";

	const action = ac.inputSchema(z.object({ userId: z.string().uuid() })).action(async ({ parsedInput }) => {
		return {
			userId: parsedInput.userId,
		};
	});

	const actionWithExcessArgs = action as (...args: unknown[]) => Promise<unknown>;
	const actualResult = await actionWithExcessArgs({ userId }, "extraneous", "malicious");
	const expectedResult = {
		data: {
			userId,
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with bind args input schemas silently ignores excess arguments", async () => {
	const username = "johndoe";
	const age = 30;

	const action = ac
		.bindArgsSchemas<[username: z.ZodString, age: z.ZodNumber]>([z.string(), z.number()])
		.outputSchema(z.object({ username: z.string(), age: z.number() }))
		.action(async ({ bindArgsParsedInputs: [username, age] }) => {
			return {
				username,
				age,
			};
		});

	const actionWithExcessArgs = action as (...args: unknown[]) => Promise<unknown>;
	const actualResult = await actionWithExcessArgs(username, age, "extraneous", "malicious");
	const expectedResult = {
		data: {
			username,
			age,
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

// Fewer arguments tests: missing arguments should result in validation errors, not crashes.

test("action with input schema called with no arguments returns validation errors", async () => {
	const action = ac.inputSchema(z.object({ userId: z.string().uuid() })).action(async ({ parsedInput }) => {
		return {
			userId: parsedInput.userId,
		};
	});

	const actionWithNoArgs = action as (...args: unknown[]) => Promise<unknown>;
	const actualResult = await actionWithNoArgs();

	expect(actualResult).toBeTruthy();
	expect(typeof actualResult === "object" && actualResult !== null && "validationErrors" in actualResult).toBe(true);
});

test("action with bind args input schemas called with no arguments returns server error", async () => {
	const action = ac
		.bindArgsSchemas<[username: z.ZodString, age: z.ZodNumber]>([z.string(), z.number()])
		.action(async ({ bindArgsParsedInputs: [username, age] }) => {
			return {
				username,
				age,
			};
		});

	const actionWithNoArgs = action as (...args: unknown[]) => Promise<unknown>;
	const actualResult = await actionWithNoArgs();

	expect(actualResult).toBeTruthy();
	expect(typeof actualResult === "object" && actualResult !== null && "serverError" in actualResult).toBe(true);
});

test("action with input schema and bind args called with only bind args returns validation errors", async () => {
	const action = ac
		.inputSchema(z.object({ userId: z.string().uuid() }))
		.bindArgsSchemas<[username: z.ZodString]>([z.string()])
		.action(async ({ parsedInput, bindArgsParsedInputs: [username] }) => {
			return {
				userId: parsedInput.userId,
				username,
			};
		});

	const actionWithPartialArgs = action as (...args: unknown[]) => Promise<unknown>;
	const actualResult = await actionWithPartialArgs("johndoe");

	expect(actualResult).toBeTruthy();
	expect(typeof actualResult === "object" && actualResult !== null && "validationErrors" in actualResult).toBe(true);
});
