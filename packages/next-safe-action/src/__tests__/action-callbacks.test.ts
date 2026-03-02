import { expect, test } from "vitest";
import { z } from "zod";
import { DEFAULT_SERVER_ERROR_MESSAGE, createSafeActionClient, returnValidationErrors } from "..";

const ac = createSafeActionClient({
	defineMetadataSchema() {
		return z.object({
			actionName: z.string(),
		});
	},
})
	.use(async ({ next }) => {
		return next({ ctx: { foo: "bar" } });
	})
	.metadata({ actionName: "test" });

test("action with no input schema and no server errors calls `onSuccess` and `onSettled` callbacks", async () => {
	let executed = 0;

	const action = ac.action(
		async () => {
			return;
		},
		{
			onSuccess: async () => {
				executed++;
			},
			onError: async () => {
				executed++; // should not be called
			},
			onSettled: async () => {
				executed++;
			},
		}
	);

	await action();
	expect(executed).toBe(2);
});

test("action with input schemas and no errors calls `onSuccess` and `onSettled` callbacks with correct arguments", async () => {
	let executed = 0;
	const inputs = [crypto.randomUUID(), 30, { username: "johndoe" }] as const;

	const action = ac
		.inputSchema(z.object({ username: z.string().min(3) }))
		.bindArgsSchemas([z.string().uuid(), z.number().positive()])
		.action(
			async () => {
				return {
					ok: true,
				};
			},
			{
				onSuccess: async ({
					clientInput,
					bindArgsClientInputs,
					parsedInput,
					bindArgsParsedInputs,
					data,
					metadata,
					ctx,
				}) => {
					executed++;

					expect({
						clientInput,
						bindArgsClientInputs,
						parsedInput,
						bindArgsParsedInputs,
						data,
						metadata,
						ctx,
					}).toStrictEqual({
						metadata: { actionName: "test" },
						ctx: { foo: "bar" },
						clientInput: inputs[2],
						bindArgsClientInputs: inputs.slice(0, 2),
						parsedInput: inputs[2],
						bindArgsParsedInputs: inputs.slice(0, 2),
						data: {
							ok: true,
						},
					});
				},
				onError: async () => {
					executed++; // should not be called
				},
				onSettled: async ({ clientInput, bindArgsClientInputs, result, metadata, ctx }) => {
					executed++;

					expect({ clientInput, bindArgsClientInputs, result, metadata, ctx }).toStrictEqual({
						metadata: { actionName: "test" },
						ctx: { foo: "bar" },
						clientInput: inputs[2],
						bindArgsClientInputs: inputs.slice(0, 2),
						result: {
							data: {
								ok: true,
							},
						},
					});
				},
			}
		);

	await action(...inputs);
	expect(executed).toBe(2);
});

test("action with input schemas and server error calls `onError` and `onSettled` callbacks with correct arguments", async () => {
	let executed = 0;
	const inputs = [crypto.randomUUID(), 30, { username: "johndoe" }] as const;

	const action = ac
		.inputSchema(z.object({ username: z.string().min(3) }))
		.bindArgsSchemas([z.string().uuid(), z.number().positive()])
		.action(
			async () => {
				throw new Error("Server error");
			},
			{
				onSuccess: async () => {
					executed++; // should not be called
				},
				onError: async ({ error, clientInput, bindArgsClientInputs, metadata, ctx }) => {
					executed++;

					expect({ error, clientInput, bindArgsClientInputs, metadata, ctx }).toStrictEqual({
						metadata: { actionName: "test" },
						ctx: { foo: "bar" },
						error: {
							serverError: DEFAULT_SERVER_ERROR_MESSAGE,
						},
						clientInput: inputs[2],
						bindArgsClientInputs: inputs.slice(0, 2),
					});
				},
				onSettled: async ({ clientInput, bindArgsClientInputs, result, metadata, ctx }) => {
					executed++;

					expect({ result, clientInput, bindArgsClientInputs, metadata, ctx }).toStrictEqual({
						metadata: { actionName: "test" },
						ctx: { foo: "bar" },
						result: {
							serverError: DEFAULT_SERVER_ERROR_MESSAGE,
						},
						clientInput: inputs[2],
						bindArgsClientInputs: inputs.slice(0, 2),
					});
				},
			}
		);

	await action(...inputs);
	expect(executed).toBe(2);
});

test("action with validation errors calls `onError` and `onSettled` callbacks with correct arguments", async () => {
	let executed = 0;
	const inputs = [crypto.randomUUID(), 30, { username: "j" }] as const;

	const action = ac
		.inputSchema(z.object({ username: z.string().min(3) }))
		.bindArgsSchemas([z.string().uuid(), z.number().positive()])
		.action(
			async () => {
				return {
					ok: true,
				};
			},
			{
				onSuccess: async () => {
					executed++; // should not be called
				},
				onError: async ({ error, clientInput, bindArgsClientInputs, metadata, ctx }) => {
					executed++;

					expect({ error, clientInput, bindArgsClientInputs, metadata, ctx }).toStrictEqual({
						metadata: { actionName: "test" },
						ctx: { foo: "bar" },
						error: {
							validationErrors: {
								username: {
									_errors: ["String must contain at least 3 character(s)"],
								},
							},
						},
						clientInput: inputs[2],
						bindArgsClientInputs: inputs.slice(0, 2),
					});
				},
				onSettled: async ({ clientInput, bindArgsClientInputs, result, metadata, ctx }) => {
					executed++;

					expect({ result, clientInput, bindArgsClientInputs, metadata, ctx }).toStrictEqual({
						metadata: { actionName: "test" },
						ctx: { foo: "bar" },
						result: {
							validationErrors: {
								username: {
									_errors: ["String must contain at least 3 character(s)"],
								},
							},
						},
						clientInput: inputs[2],
						bindArgsClientInputs: inputs.slice(0, 2),
					});
				},
			}
		);

	await action(...inputs);
	expect(executed).toBe(2);
});

test("action with server validation error calls `onError` and `onSettled` callbacks with correct arguments", async () => {
	let executed = 0;

	const schema = z.object({
		username: z.string(),
	});
	const action = ac.inputSchema(z.object({ username: z.string().min(3) })).action(
		async () => {
			returnValidationErrors(schema, {
				username: {
					_errors: ["Invalid username"],
				},
			});
		},
		{
			onSuccess: async () => {
				executed++; // should not be called
			},
			onError: async ({ error, clientInput, bindArgsClientInputs, metadata, ctx }) => {
				executed++;

				expect({ error, clientInput, bindArgsClientInputs, metadata, ctx }).toStrictEqual({
					metadata: { actionName: "test" },
					ctx: { foo: "bar" },
					error: {
						validationErrors: {
							username: {
								_errors: ["Invalid username"],
							},
						},
					},
					clientInput: { username: "johndoe" },
					bindArgsClientInputs: [],
				});
			},
			onSettled: async ({ clientInput, bindArgsClientInputs, result, metadata, ctx }) => {
				executed++;

				expect({ result, clientInput, bindArgsClientInputs, metadata, ctx }).toStrictEqual({
					metadata: { actionName: "test" },
					ctx: { foo: "bar" },
					result: {
						validationErrors: {
							username: {
								_errors: ["Invalid username"],
							},
						},
					},
					clientInput: { username: "johndoe" },
					bindArgsClientInputs: [],
				});
			},
		}
	);

	await action({ username: "johndoe" });
	expect(executed).toBe(2);
});
