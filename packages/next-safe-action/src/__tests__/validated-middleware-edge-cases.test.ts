import { expect, test } from "vitest";
import { z } from "zod";
import { createSafeActionClient, returnValidationErrors } from "..";

const ac = createSafeActionClient({
	handleServerError(e) {
		return e.message;
	},
});

test("no useValidated: existing behavior unchanged", async () => {
	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		.action(async ({ parsedInput }) => ({ name: parsedInput.name }));

	const result = await action({ name: "test" });

	expect(result).toStrictEqual({
		data: { name: "test" },
	});
});

test("useValidated with outputSchema: output validation still runs", async () => {
	const validAction = ac
		.inputSchema(z.string())
		.outputSchema(z.object({ value: z.string() }))
		.useValidated(async ({ next }) => next())
		.action(async () => ({ value: "ok" }));

	const validResult = await validAction("hello");

	expect(validResult).toStrictEqual({
		data: { value: "ok" },
	});

	const invalidAction = ac
		.inputSchema(z.string())
		.outputSchema(z.object({ value: z.number() }))
		.useValidated(async ({ next }) => next())
		.action(async () => ({ value: "not a number" as any }));

	const invalidResult = await invalidAction("hello");

	expect(invalidResult).toHaveProperty("serverError");
});

test("returnValidationErrors works inside useValidated middleware", async () => {
	const schema = z.object({ email: z.string().email() });
	const action = ac
		.inputSchema(schema)
		.useValidated(async ({ parsedInput, next }) => {
			if (parsedInput.email === "banned@test.com") {
				returnValidationErrors(schema, { email: { _errors: ["Email is banned"] } });
			}
			return next();
		})
		.action(async ({ parsedInput }) => ({ email: parsedInput.email }));

	const bannedResult = await action({ email: "banned@test.com" });

	expect(bannedResult).toHaveProperty("validationErrors");
	expect(bannedResult.validationErrors).toStrictEqual({
		email: { _errors: ["Email is banned"] },
	});

	const okResult = await action({ email: "ok@test.com" });

	expect(okResult).toStrictEqual({
		data: { email: "ok@test.com" },
	});
});

test("metadata is accessible in useValidated middleware", async () => {
	const acMeta = createSafeActionClient({
		handleServerError(e) {
			return e.message;
		},
		defineMetadataSchema: () => z.object({ actionName: z.string() }),
	});

	let capturedMetadata: { actionName: string } | undefined;

	const action = acMeta
		.metadata({ actionName: "testAction" })
		.inputSchema(z.string())
		.useValidated(async ({ metadata, next }) => {
			capturedMetadata = metadata;
			return next();
		})
		.action(async () => ({ ok: true }));

	await action("hello");

	expect(capturedMetadata).toStrictEqual({ actionName: "testAction" });
});

test("useValidated with only bindArgsSchemas (no inputSchema)", async () => {
	let capturedBindArgsParsedInputs: unknown;

	const action = ac
		.bindArgsSchemas([z.number(), z.string()])
		.useValidated(async ({ bindArgsParsedInputs, parsedInput, next }) => {
			capturedBindArgsParsedInputs = bindArgsParsedInputs;
			// parsedInput should be undefined since no inputSchema is defined
			expect(parsedInput).toBeUndefined();
			return next();
		})
		.action(async () => ({ ok: true }));

	const result = await action(42, "hello");

	expect(result).toStrictEqual({ data: { ok: true } });
	expect(capturedBindArgsParsedInputs).toStrictEqual([42, "hello"]);
});

test("validated middleware error prevents server code execution", async () => {
	let serverCodeExecuted = false;

	const action = ac
		.inputSchema(z.string())
		.useValidated(async () => {
			throw new Error("validated error");
		})
		.action(async () => {
			serverCodeExecuted = true;
			return { ok: true };
		});

	const result = await action("hello");

	expect(serverCodeExecuted).toBe(false);
	expect(result).toStrictEqual({ serverError: "validated error" });
});

test("useValidated works with stateAction", async () => {
	let capturedParsedInput: string | undefined;

	const action = ac
		.inputSchema(z.string())
		.useValidated(async ({ parsedInput, next }) => {
			capturedParsedInput = parsedInput;
			return next();
		})
		.stateAction(async ({ parsedInput }) => ({ value: parsedInput }));

	const result = await action({}, "hello");

	expect(capturedParsedInput).toBe("hello");
	expect(result).toStrictEqual({
		data: { value: "hello" },
	});
});
