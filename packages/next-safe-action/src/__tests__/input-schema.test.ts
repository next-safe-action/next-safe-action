import { expect, test } from "vitest";
import { z } from "zod";
import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from "..";
import type { StandardSchemaV1 } from "../standard-schema";

const ac = createSafeActionClient();

test("inputSchema with clientInput parameter receives actual input data", async () => {
	let receivedClientInput: unknown;

	const action = ac
		.inputSchema(async (_, { clientInput }) => {
			receivedClientInput = clientInput;
			return z.object({ message: z.string() });
		})
		.action(async ({ parsedInput }) => {
			return { success: true, data: parsedInput };
		});

	const testData = { message: "Hello World" };
	const result = await action(testData);

	expect(receivedClientInput).toStrictEqual(testData);
	expect(result).toStrictEqual({ data: { success: true, data: testData } });
});

test("inputSchema chaining with prevSchema and clientInput works correctly", async () => {
	let receivedPrevSchema: unknown;
	let receivedClientInput: unknown;

	const action = ac
		.inputSchema(z.object({ test: z.boolean() }))
		.inputSchema(async (prevSchema) => {
			return prevSchema.extend({ name: z.string() });
		})
		.inputSchema(async (prevSchema, { clientInput }) => {
			receivedPrevSchema = prevSchema;
			receivedClientInput = clientInput;
			return prevSchema.extend({ age: z.number() });
		})
		.action(async ({ parsedInput }) => {
			return { success: true, data: parsedInput };
		});

	const testData = { test: true, name: "John", age: 25 };
	const result = await action(testData);

	expect(receivedPrevSchema).toBeTruthy(); // Should be a Zod schema object
	expect(receivedClientInput).toStrictEqual(testData);
	expect(result).toStrictEqual({ data: { success: true, data: testData } });
});

test("inputSchema chaining validates against extended schema without function", async () => {
	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		.inputSchema(async (prevSchema) => {
			return prevSchema.extend({ age: z.number() });
		})
		.action(async ({ parsedInput }) => {
			return { success: true, data: parsedInput };
		});

	// Valid data should work
	const validResult = await action({ name: "John", age: 25 });
	expect(validResult).toStrictEqual({ data: { success: true, data: { name: "John", age: 25 } } });

	// Invalid data should return validation errors
	// @ts-expect-error
	const invalidResult = await action({ name: "Jane" }); // Missing age
	expect(invalidResult.validationErrors).toBeTruthy();
	expect(invalidResult.validationErrors!.age).toBeTruthy();
});

test("inputSchema chaining validates against extended schema with function", async () => {
	const action = ac
		.inputSchema(async () => {
			return z.object({ name: z.string() });
		})
		.inputSchema(async (prevSchema) => {
			return prevSchema.extend({ age: z.number() });
		})
		.action(async ({ parsedInput }) => {
			return { success: true, data: parsedInput };
		});

	// Valid data should work
	const validResult = await action({ name: "John", age: 25 });
	expect(validResult).toStrictEqual({ data: { success: true, data: { name: "John", age: 25 } } });

	// Invalid data should return validation errors
	// @ts-expect-error
	const invalidResult = await action({ name: "Jane" }); // Missing age
	expect(invalidResult.validationErrors).toBeTruthy();
	expect(invalidResult.validationErrors!.age).toBeTruthy();
});

test("inputSchema with clientInput can build dynamic Zod schema", async () => {
	const action = ac
		.inputSchema(async (_, { clientInput }) => {
			if ((clientInput as { type: string })?.type === "user") {
				return z.object({
					type: z.literal("user"),
					name: z.string(),
					email: z.string().email(),
				});
			}

			return z.object({
				type: z.string(),
				data: z.any(),
			});
		})
		.action(async ({ parsedInput }) => {
			return { success: true, data: parsedInput };
		});

	const userResult = await action({ type: "user", name: "John", email: "john@example.com" });
	expect(userResult).toStrictEqual({
		data: { success: true, data: { type: "user", name: "John", email: "john@example.com" } },
	});

	const defaultResult = await action({ type: "other", data: "anything" });
	expect(defaultResult).toStrictEqual({
		data: { success: true, data: { type: "other", data: "anything" } },
	});
});

test("inputSchema with clientInput still receives main input when excess arguments are passed", async () => {
	let receivedClientInput: unknown;

	const action = ac
		.inputSchema(async (_, { clientInput }) => {
			receivedClientInput = clientInput;

			if ((clientInput as { type?: string })?.type === "user") {
				return z.object({
					type: z.literal("user"),
					name: z.string(),
					email: z.string().email(),
				});
			}

			return z.object({
				type: z.string(),
				data: z.any(),
			});
		})
		.action(async ({ parsedInput }) => {
			return { success: true, data: parsedInput };
		});

	const input = { type: "user", name: "John", email: "john@example.com" };
	const actionWithExcessArgs = action as (...args: unknown[]) => Promise<unknown>;
	const result = await actionWithExcessArgs(input, { client: "rq" }, "extra");

	expect(receivedClientInput).toStrictEqual(input);
	expect(result).toStrictEqual({
		data: { success: true, data: input },
	});
});

test("inputSchema function throws error when clientInput is invalid", async () => {
	const action = ac
		.inputSchema(async (_, { clientInput }) => {
			// Throw error if clientInput is missing required field
			if (!(clientInput as { type?: unknown })?.type) {
				throw new Error("Missing required field: type");
			}

			return z.object({
				type: z.string(),
				data: z.any(),
			});
		})
		.action(async ({ parsedInput }) => {
			return { success: true, data: parsedInput };
		});

	// Test with missing type field - should throw
	// @ts-expect-error
	const result = await action({ data: "some data" });

	// Should return server error when inputSchema function throws
	expect(result).toStrictEqual({
		serverError: DEFAULT_SERVER_ERROR_MESSAGE,
	});
});

test("inputSchema treats callable Standard Schema validators as direct validators", async () => {
	let factoryInvocationCount = 0;

	const callableSchema = Object.assign(
		() => {
			factoryInvocationCount += 1;
			throw new Error("callable schema should not be invoked as a schema factory");
		},
		{
			"~standard": {
				version: 1 as const,
				vendor: "test",
				validate(value: unknown) {
					if (typeof value === "object" && value !== null && typeof (value as { name?: unknown }).name === "string") {
						return {
							value: {
								name: (value as { name: string }).name,
							},
						} as const;
					}

					return {
						issues: [{ message: "Invalid name", path: ["name"] }],
					} as const;
				},
			},
		}
	) as unknown as StandardSchemaV1<{ name: string }>;

	const action = ac.inputSchema(callableSchema).action(async ({ parsedInput }) => {
		return parsedInput;
	});

	const validResult = await action({ name: "John" });
	expect(validResult).toStrictEqual({ data: { name: "John" } });
	expect(factoryInvocationCount).toBe(0);

	// @ts-expect-error
	const invalidResult = await action({});
	expect(invalidResult.validationErrors).toBeTruthy();
	expect(invalidResult.validationErrors!.name).toBeTruthy();
	expect(factoryInvocationCount).toBe(0);
});

test("inputSchema throws for sync non-schema functions", () => {
	try {
		ac.inputSchema((() => z.object({ name: z.string() })) as any);
		expect.unreachable("Should have thrown TypeError");
	} catch (e) {
		expect(e).toBeInstanceOf(TypeError);
		expect((e as TypeError).message).toContain("Standard Schema validator");
		expect((e as TypeError).message).toContain("async function");
	}
});
