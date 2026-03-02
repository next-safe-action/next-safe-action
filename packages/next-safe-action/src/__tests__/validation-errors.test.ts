import { expect, test } from "vitest";
import { z } from "zod";
import type { ValidationErrors } from "..";
import {
	createSafeActionClient,
	DEFAULT_SERVER_ERROR_MESSAGE,
	flattenValidationErrors,
	formatValidationErrors,
	returnValidationErrors,
} from "..";
import { ActionOutputDataValidationError } from "../validation-errors";

// Default client tests.

const dac = createSafeActionClient();

test("action with invalid input gives back an object with correct `validationErrors` (default formatted shape)", async () => {
	const schema = z.object({
		user: z.object({
			id: z.string().min(36).uuid(),
		}),
		store: z.object({
			id: z.string().min(36).uuid(),
			product: z.object({
				id: z.string().min(36).uuid(),
			}),
		}),
	});

	const action = dac.inputSchema(schema).action(async () => {
		return {
			ok: true,
		};
	});

	const actualResult = await action({
		user: {
			id: "invalid_uuid",
		},
		store: {
			id: "invalid_uuid",
			product: {
				id: "invalid_uuid",
			},
		},
	});

	const expectedResult = {
		validationErrors: {
			user: {
				id: {
					_errors: ["String must contain at least 36 character(s)", "Invalid uuid"],
				},
			},
			store: {
				id: {
					_errors: ["String must contain at least 36 character(s)", "Invalid uuid"],
				},
				product: {
					id: {
						_errors: ["String must contain at least 36 character(s)", "Invalid uuid"],
					},
				},
			},
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with invalid enum input gives back an object with correct `validationErrors` (default formatted shape)", async () => {
	const schema = z.object({
		foo: z.object({
			bar: z.union([z.literal("a"), z.literal("b")]),
		}),
		baz: z.string().min(3),
	});

	const action = dac.inputSchema(schema).action(async () => {
		return {
			ok: true,
		};
	});

	const actualResult = await action({
		foo: {
			// @ts-expect-error
			bar: "c",
		},
		baz: "a",
	});

	const expectedResult = {
		validationErrors: {
			foo: {
				bar: {
					_errors: ['Invalid literal value, expected "a"', 'Invalid literal value, expected "b"'],
				},
			},
			baz: {
				_errors: ["String must contain at least 3 character(s)"],
			},
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with root level schema error gives back an object with correct `validationErrors` (default formatted shape)", async () => {
	const userId = "invalid_uuid";

	// Test with async function that returns the schema.
	async function getSchema() {
		return z
			.object({
				userId: z.string().min(36).uuid(),
				password: z.string(),
				confirmPassword: z.string(),
			})
			.refine((d) => d.password === d.confirmPassword, {
				message: "Passwords do not match",
			});
	}

	const action = dac.inputSchema(getSchema).action(async () => {
		return {
			ok: true,
		};
	});

	const actualResult = await action({
		userId,
		password: "test123",
		confirmPassword: "test456",
	});

	const expectedResult = {
		validationErrors: {
			_errors: ["Passwords do not match"],
			userId: {
				_errors: ["String must contain at least 36 character(s)", "Invalid uuid"],
			},
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with invalid input gives back an object with correct `validationErrors` (default formatted shape overridden by custom flattened shape)", async () => {
	const schema = z
		.object({
			userId: z.string().min(36).uuid(),
			storeId: z.string().min(36).uuid(),
		})
		.refine((d) => d.userId !== d.storeId, {
			message: "User id and store id cannot be the same",
		});

	const action = dac
		.inputSchema(schema, {
			handleValidationErrorsShape: async (ve) => flattenValidationErrors(ve),
		})
		.action(async () => {
			return {
				ok: true,
			};
		});

	const actualResult = await action({
		userId: "invalid_uuid",
		storeId: "invalid_uuid",
	});

	const expectedResult = {
		validationErrors: {
			formErrors: ["User id and store id cannot be the same"],
			fieldErrors: {
				userId: ["String must contain at least 36 character(s)", "Invalid uuid"],
				storeId: ["String must contain at least 36 character(s)", "Invalid uuid"],
			},
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with invalid output data returns the default `serverError`", async () => {
	const action = dac.outputSchema(z.object({ result: z.string().min(3) })).action(async () => {
		return {
			result: "ok",
		};
	});

	const actualResult = await action();

	const expectedResult = {
		serverError: DEFAULT_SERVER_ERROR_MESSAGE,
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with invalid output data throws an error of the correct type", async () => {
	const tac = createSafeActionClient({
		handleServerError: (e) => {
			// disable server error logging for this test
			throw e;
		},
	});

	const outputSchema = z.object({ result: z.string().min(3) });

	const action = tac.outputSchema(outputSchema).action(async () => {
		return {
			result: "ok",
		};
	});

	const expectedResult = {
		serverError: "String must contain at least 3 character(s)",
	};

	const actualResult = {
		serverError: "",
	};

	try {
		await action();
	} catch (e) {
		if (e instanceof ActionOutputDataValidationError) {
			actualResult.serverError =
				(e.validationErrors as ValidationErrors<typeof outputSchema>).result?._errors?.[0] ?? "";
		}
	}

	expect(actualResult).toStrictEqual(expectedResult);
});

// Formatted shape tests (same as default).

const foac = createSafeActionClient({
	defaultValidationErrorsShape: "formatted",
});

test("action with invalid input gives back an object with correct `validationErrors` (set formatted shape)", async () => {
	const schema = z.object({
		user: z.object({
			id: z.string().min(36).uuid(),
		}),
		store: z.object({
			id: z.string().min(36).uuid(),
			product: z.object({
				id: z.string().min(36).uuid(),
			}),
		}),
	});

	const action = foac.inputSchema(schema).action(async () => {
		return {
			ok: true,
		};
	});

	const actualResult = await action({
		user: {
			id: "invalid_uuid",
		},
		store: {
			id: "invalid_uuid",
			product: {
				id: "invalid_uuid",
			},
		},
	});

	const expectedResult = {
		validationErrors: {
			user: {
				id: {
					_errors: ["String must contain at least 36 character(s)", "Invalid uuid"],
				},
			},
			store: {
				id: {
					_errors: ["String must contain at least 36 character(s)", "Invalid uuid"],
				},
				product: {
					id: {
						_errors: ["String must contain at least 36 character(s)", "Invalid uuid"],
					},
				},
			},
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with root level schema error gives back an object with correct `validationErrors` (set formatted shape)", async () => {
	const userId = "invalid_uuid";

	const schema = z
		.object({
			userId: z.string().uuid(),
			password: z.string(),
			confirmPassword: z.string(),
		})
		.refine((d) => d.password === d.confirmPassword, {
			message: "Passwords do not match",
		})
		.refine((d) => d.userId === "488d92e3-d394-4db8-b7c0-7b38c85280c1", {
			message: "UUID mismatch",
		});

	const action = foac.inputSchema(schema).action(async () => {
		return {
			ok: true,
		};
	});

	const actualResult = await action({
		userId,
		password: "test123",
		confirmPassword: "test456",
	});

	const expectedResult = {
		validationErrors: {
			_errors: ["Passwords do not match", "UUID mismatch"],
			userId: {
				_errors: ["Invalid uuid"],
			},
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with invalid input gives back an object with correct `validationErrors` (set formatted shape overridden by custom flattened shape)", async () => {
	const schema = z
		.object({
			userId: z.string().min(36).uuid(),
			storeId: z.string().min(36).uuid(),
		})
		.refine((d) => d.userId !== d.storeId, {
			message: "User id and store id cannot be the same",
		});

	const action = foac
		.inputSchema(schema, {
			handleValidationErrorsShape: async (ve) => flattenValidationErrors(ve),
		})
		.action(async () => {
			return {
				ok: true,
			};
		});

	const actualResult = await action({
		userId: "invalid_uuid",
		storeId: "invalid_uuid",
	});

	const expectedResult = {
		validationErrors: {
			formErrors: ["User id and store id cannot be the same"],
			fieldErrors: {
				userId: ["String must contain at least 36 character(s)", "Invalid uuid"],
				storeId: ["String must contain at least 36 character(s)", "Invalid uuid"],
			},
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

// Flattened shape tests.

const flac = createSafeActionClient({
	defaultValidationErrorsShape: "flattened",
});

test("action with invalid input gives back an object with correct `validationErrors` (set flattened shape)", async () => {
	const schema = z.object({
		userId: z.string().min(36).uuid(),
		storeId: z.string().min(36).uuid(),
		store: z.object({
			product: z.object({
				id: z.string().uuid(),
			}),
		}),
	});

	const action = flac.inputSchema(schema).action(async () => {
		return {
			ok: true,
		};
	});

	const actualResult = await action({
		userId: "invalid_uuid",
		storeId: "invalid_uuid",
		store: {
			product: {
				id: "invalid_uuid",
			},
		},
	});

	// Flattened shape discards errors for nested properties.
	const expectedResult = {
		validationErrors: {
			formErrors: [],
			fieldErrors: {
				userId: ["String must contain at least 36 character(s)", "Invalid uuid"],
				storeId: ["String must contain at least 36 character(s)", "Invalid uuid"],
			},
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with root level schema error gives back an object with correct `validationErrors` (set flattened shape)", async () => {
	const schema = z
		.object({
			userId: z.string().min(36).uuid(),
			storeId: z.string().min(36).uuid(),
			store: z.object({
				product: z.object({
					id: z.string().uuid(),
				}),
			}),
		})
		.refine((d) => d.userId !== d.storeId, {
			message: "User and store IDs must be different",
		})
		.refine((d) => d.userId !== d.storeId, {
			message: "Another cool global error",
		});

	const action = flac.inputSchema(schema).action(async () => {
		return {
			ok: true,
		};
	});

	const actualResult = await action({
		userId: "invalid_uuid",
		storeId: "invalid_uuid",
		store: {
			product: {
				id: "invalid_uuid",
			},
		},
	});

	// Flattened shape discards errors for nested properties.
	const expectedResult = {
		validationErrors: {
			formErrors: ["User and store IDs must be different", "Another cool global error"],
			fieldErrors: {
				userId: ["String must contain at least 36 character(s)", "Invalid uuid"],
				storeId: ["String must contain at least 36 character(s)", "Invalid uuid"],
			},
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with invalid input gives back an object with correct `validationErrors` (set flattened shape overridden by custom formatted shape)", async () => {
	const schema = z
		.object({
			userId: z.string().min(36).uuid(),
			storeId: z.string().min(36).uuid(),
		})
		.refine((d) => d.userId !== d.storeId, {
			message: "User id and store id cannot be the same",
		});

	const action = flac
		.inputSchema(schema, {
			handleValidationErrorsShape: async (ve) => formatValidationErrors(ve),
		})
		.action(async () => {
			return {
				ok: true,
			};
		});

	const actualResult = await action({
		userId: "invalid_uuid",
		storeId: "invalid_uuid",
	});

	const expectedResult = {
		validationErrors: {
			_errors: ["User id and store id cannot be the same"],
			userId: {
				_errors: ["String must contain at least 36 character(s)", "Invalid uuid"],
			},
			storeId: {
				_errors: ["String must contain at least 36 character(s)", "Invalid uuid"],
			},
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

// `returnValidationErrors` tests.

test("action with errors set via `returnValidationErrors` gives back an object with correct `validationErrors` (default formatted shape)", async () => {
	const schema = z.object({
		username: z.string(),
		password: z.string(),
	});

	const errorsObject = {
		_errors: ["incorrect_credentials", "another_error"],
		username: {
			_errors: ["user_suspended"],
		},
		password: {
			_errors: ["invalid_password"],
		},
	};

	const action = dac.inputSchema(schema).action(async ({ parsedInput }) => {
		if (parsedInput.username !== "johndoe" && parsedInput.password !== "password") {
			returnValidationErrors(schema, structuredClone(errorsObject));
		}

		return {
			ok: true,
		};
	});

	const actualResult = await action({
		username: "123",
		password: "456",
	});

	const expectedResult = {
		validationErrors: structuredClone(errorsObject),
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with errors set via `returnValidationErrors` gives back an object with correct `validationErrors` (set formatted shape)", async () => {
	const schema = z.object({
		username: z.string(),
		password: z.string(),
	});

	const errorsObject = {
		_errors: ["incorrect_credentials", "another_error"],
		username: {
			_errors: ["user_suspended"],
		},
		password: {
			_errors: ["invalid_password"],
		},
	};

	const action = foac.inputSchema(schema).action(async ({ parsedInput }) => {
		if (parsedInput.username !== "johndoe" && parsedInput.password !== "password") {
			returnValidationErrors(schema, structuredClone(errorsObject));
		}

		return {
			ok: true,
		};
	});

	const actualResult = await action({
		username: "123",
		password: "456",
	});

	const expectedResult = {
		validationErrors: structuredClone(errorsObject),
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

test("action with errors set via `returnValidationErrors` gives back an object with correct `validationErrors` (set flattened shape)", async () => {
	const schema = z.object({
		username: z.string(),
		password: z.string(),
	});

	const action = flac.inputSchema(schema).action(async ({ parsedInput }) => {
		if (parsedInput.username !== "johndoe" && parsedInput.password !== "password") {
			returnValidationErrors(schema, {
				_errors: ["incorrect_credentials", "another_error"],
				username: {
					_errors: ["user_suspended"],
				},
				password: {
					_errors: ["invalid_password"],
				},
			});
		}

		return {
			ok: true,
		};
	});

	const actualResult = await action({
		username: "123",
		password: "456",
	});

	const expectedResult = {
		validationErrors: {
			formErrors: ["incorrect_credentials", "another_error"],
			fieldErrors: {
				username: ["user_suspended"],
				password: ["invalid_password"],
			},
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

// `throwValidationErrors` tests.

// test without `throwValidationErrors` set at the instance level, just set at the action level.
test("action with validation errors and `throwValidationErrors` option set to true at the action level throws", async () => {
	const schema = z.object({
		username: z.string().min(3),
		password: z.string().min(3),
	});

	const action = dac.inputSchema(schema).action(
		async () => {
			return {
				ok: true,
			};
		},
		{ throwValidationErrors: true }
	);

	await expect(async () => await action({ username: "12", password: "34" })).rejects.toThrow();
});

const tveac = createSafeActionClient({
	throwValidationErrors: true,
});

test("action with validation errors and `throwValidationErrors` option set to true in client throws", async () => {
	const schema = z.object({
		username: z.string().min(3),
		password: z.string().min(3),
	});

	const action = tveac.inputSchema(schema).action(async () => {
		return {
			ok: true,
		};
	});

	await expect(async () => await action({ username: "12", password: "34" })).rejects.toThrow();
});

test("action with server validation errors and `throwValidationErrors` option set to true in client throws", async () => {
	const schema = z.object({
		username: z.string().min(3),
		password: z.string().min(3),
	});

	const action = tveac.inputSchema(schema).action(async () => {
		returnValidationErrors(schema, {
			username: {
				_errors: ["user_suspended"],
			},
		});
		return {
			ok: true,
		};
	});

	await expect(async () => await action({ username: "1234", password: "5678" })).rejects.toThrow();
});

test("action with validation errors and `throwValidationErrors` option set to true both in client and action throws", async () => {
	const schema = z.object({
		username: z.string().min(3),
		password: z.string().min(3),
	});

	const action = tveac.inputSchema(schema).action(
		async () => {
			return {
				ok: true,
			};
		},
		{ throwValidationErrors: true }
	);

	await expect(async () => await action({ username: "12", password: "34" })).rejects.toThrow();
});

test("action with validation errors and overridden `throwValidationErrors` set to false at the action level doesn't throw", async () => {
	const schema = z.object({
		user: z.object({
			id: z.string().min(36).uuid(),
		}),
		store: z.object({
			id: z.string().min(36).uuid(),
			product: z.object({
				id: z.string().min(36).uuid(),
			}),
		}),
	});

	const action = tveac.inputSchema(schema).action(
		async () => {
			return {
				ok: true,
			};
		},
		{ throwValidationErrors: false }
	);

	const actualResult = await action({
		user: {
			id: "invalid_uuid",
		},
		store: {
			id: "invalid_uuid",
			product: {
				id: "invalid_uuid",
			},
		},
	});

	const expectedResult = {
		validationErrors: {
			user: {
				id: {
					_errors: ["String must contain at least 36 character(s)", "Invalid uuid"],
				},
			},
			store: {
				id: {
					_errors: ["String must contain at least 36 character(s)", "Invalid uuid"],
				},
				product: {
					id: {
						_errors: ["String must contain at least 36 character(s)", "Invalid uuid"],
					},
				},
			},
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});
