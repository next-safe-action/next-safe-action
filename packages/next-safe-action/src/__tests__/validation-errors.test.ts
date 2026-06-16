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
import { ActionOutputDataValidationError, buildValidationErrors } from "../validation-errors";

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
					_errors: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
				},
			},
			store: {
				id: {
					_errors: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
				},
				product: {
					id: {
						_errors: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
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
					_errors: ["Invalid input"],
				},
			},
			baz: {
				_errors: ["Too small: expected string to have >=3 characters"],
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
				_errors: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
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
				userId: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
				storeId: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
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
		serverError: "Too small: expected string to have >=3 characters",
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
					_errors: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
				},
			},
			store: {
				id: {
					_errors: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
				},
				product: {
					id: {
						_errors: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
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
				_errors: ["Invalid UUID"],
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
				userId: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
				storeId: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
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
				userId: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
				storeId: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
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
				userId: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
				storeId: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
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
				_errors: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
			},
			storeId: {
				_errors: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
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
					_errors: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
				},
			},
			store: {
				id: {
					_errors: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
				},
				product: {
					id: {
						_errors: ["Too small: expected string to have >=36 characters", "Invalid UUID"],
					},
				},
			},
		},
	};

	expect(actualResult).toStrictEqual(expectedResult);
});

// --- Prototype pollution regression tests ---
//
// Standard Schema issue paths can contain client-controlled segments (e.g. a `z.record`
// whose object keys come from user input). `buildValidationErrors` walks those paths to
// build the nested errors object, so a hostile path like ["constructor", "prototype", X]
// or ["__proto__", X] must never reach `Object.prototype`.

test("buildValidationErrors does not pollute Object.prototype via a constructor/prototype path", () => {
	expect(({} as Record<string, unknown>).polluted_via_ctor).toBeUndefined();

	try {
		buildValidationErrors([{ path: ["constructor", "prototype", "polluted_via_ctor"], message: "x" }] as never);

		// The hostile key must be stored as a plain own property, not written to the global prototype.
		expect(({} as Record<string, unknown>).polluted_via_ctor).toBeUndefined();
	} finally {
		delete (Object.prototype as Record<string, unknown>).polluted_via_ctor;
	}
});

test("buildValidationErrors does not pollute Object.prototype via a __proto__ path", () => {
	expect(({} as Record<string, unknown>).polluted_via_proto).toBeUndefined();

	try {
		buildValidationErrors([{ path: ["__proto__", "polluted_via_proto"], message: "x" }] as never);

		expect(({} as Record<string, unknown>).polluted_via_proto).toBeUndefined();
	} finally {
		delete (Object.prototype as Record<string, unknown>).polluted_via_proto;
	}
});

test("action with a record schema cannot pollute Object.prototype through hostile input keys", async () => {
	// A nested record schema where every object key comes from client input. The malicious
	// payload walks the prototype chain; the final (failing) leaf key is what would be written.
	const schema = z.record(z.string(), z.record(z.string(), z.record(z.string(), z.string())));

	const action = dac.inputSchema(schema).action(async () => ({ ok: true }));

	expect(({} as Record<string, unknown>).polluted_e2e).toBeUndefined();

	try {
		// `__proto__` would set the prototype, so we use own-property syntax via JSON.parse.
		const malicious = JSON.parse('{"constructor":{"prototype":{"polluted_e2e":123}}}');
		const result = await action(malicious);

		// Must be reported as validation errors, and must NOT have polluted the global prototype.
		expect("validationErrors" in result).toBe(true);
		expect(({} as Record<string, unknown>).polluted_e2e).toBeUndefined();
	} finally {
		delete (Object.prototype as Record<string, unknown>).polluted_e2e;
	}
});

test("buildValidationErrors still represents a field literally named 'constructor' faithfully", () => {
	const ve = buildValidationErrors([{ path: ["constructor"], message: "bad" }] as never) as Record<
		string,
		{ _errors: string[] }
	>;

	// The field is preserved as an own property carrying its errors (no data loss from the fix).
	expect(Object.hasOwn(ve, "constructor")).toBe(true);
	const ctorField = Object.entries(ve).find(([k]) => k === "constructor")?.[1];
	expect(ctorField?._errors).toStrictEqual(["bad"]);
});

test("flattenValidationErrors does not pollute via a hostile __proto__ key and still flattens normal fields", () => {
	expect(({} as Record<string, unknown>).polluted_flatten).toBeUndefined();

	try {
		// Own `__proto__` key (only constructible via JSON.parse), as could arrive from a
		// degraded validation payload recovered from the digest.
		const hostile = JSON.parse('{"__proto__":{"_errors":["polluted_flatten"]},"username":{"_errors":["taken"]}}');

		const flattened = flattenValidationErrors(hostile);

		expect(({} as Record<string, unknown>).polluted_flatten).toBeUndefined();
		expect(Array.isArray(Object.getPrototypeOf(flattened.fieldErrors))).toBe(false);
		expect(flattened.fieldErrors.username).toStrictEqual(["taken"]);
	} finally {
		delete (Object.prototype as Record<string, unknown>).polluted_flatten;
	}
});
