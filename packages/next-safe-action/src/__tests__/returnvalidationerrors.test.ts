import { expect, test } from "vitest";
import { z } from "zod";
import {
	createSafeActionClient,
	DEFAULT_SERVER_ERROR_MESSAGE,
	flattenValidationErrors,
	returnValidationErrors,
} from "..";

// Simulates a domain-layer error class (e.g. a unique constraint violation).
class FieldError extends Error {
	constructor(
		public readonly field: string,
		public readonly description: string
	) {
		super(description);
	}
}

// Simulates what Next.js does to an error thrown inside a `'use cache'` scope
// (with `cacheComponents` enabled): the error crosses the RSC/Flight boundary,
// which preserves only `message` and `digest` while dropping the class prototype
// and every other own property (so `instanceof` and custom fields are lost). We
// reproduce that faithfully by re-throwing a plain `Error` carrying just those
// two fields, exactly as the cache caller would receive. See issue #452.
function throwAsThroughUseCacheBoundary(fn: () => never): never {
	try {
		fn();
	} catch (e) {
		const stripped = new Error((e as Error).message);
		(stripped as { digest?: string }).digest = (e as { digest?: string }).digest;
		throw stripped;
	}
}

// Mirrors the pattern used in apps that configure handleServerError to rethrow,
// relying on a middleware to convert known domain errors into validation errors.
const ac = createSafeActionClient({
	handleServerError(e) {
		throw e;
	},
});

const dac = createSafeActionClient();

const foac = createSafeActionClient({
	defaultValidationErrorsShape: "formatted",
});

const flac = createSafeActionClient({
	defaultValidationErrorsShape: "flattened",
});

const schema = z.object({ username: z.string().min(3) });

// --- Middleware tests (regression for commit 4915d04) ---

// The middleware catches known domain errors and converts them to validation
// errors via returnValidationErrors, exactly as documented. The bug caused
// ActionServerValidationError to escape instead of being treated as
// validationErrors on the result.
const actionWithErrorMiddleware = ac
	.inputSchema(schema)
	.use(async ({ next }) => {
		try {
			return await next();
		} catch (e) {
			if (e instanceof FieldError) {
				return returnValidationErrors(schema, {
					[e.field]: { _errors: [e.description] },
				});
			}
			throw e;
		}
	})
	.action(async ({ parsedInput }) => {
		if (parsedInput.username === "taken") {
			throw new FieldError("username", "Username is already taken");
		}
		return { ok: true };
	});

test("returnValidationErrors called from a middleware catch block returns validationErrors on the result (not a thrown error)", async () => {
	const result = await actionWithErrorMiddleware({ username: "taken" });
	const expected = {
		validationErrors: {
			username: { _errors: ["Username is already taken"] },
		},
	};
	expect(result).toStrictEqual(expected);
});

test("action succeeds normally when no domain error is thrown", async () => {
	const result = await actionWithErrorMiddleware({ username: "available" });
	expect(result).toStrictEqual({ data: { ok: true } });
});

test("unhandled errors from server code still propagate when handleServerError rethrows", async () => {
	const actionThatThrows = ac
		.inputSchema(schema)
		.use(async ({ next }) => {
			try {
				return await next();
			} catch (e) {
				if (e instanceof FieldError) {
					return returnValidationErrors(schema, {
						[e.field]: { _errors: [e.description] },
					});
				}
				throw e;
			}
		})
		.action(async () => {
			throw new Error("unexpected crash");
		});
	await expect(async () => actionThatThrows({ username: "foo" })).rejects.toThrow();
});

// --- .action() tests ---

test("returnValidationErrors with only root-level _errors (no field errors) from .action()", async () => {
	const dac = createSafeActionClient();
	const action = dac.inputSchema(schema).action(async () => {
		returnValidationErrors(schema, { _errors: ["some_error"] });
		return { ok: true };
	});

	const result = await action({ username: "test" });
	expect(result).toStrictEqual({
		validationErrors: { _errors: ["some_error"] },
	});
});

test("returnValidationErrors from .action() with handleValidationErrorsShape returns flattened shape", async () => {
	const dac = createSafeActionClient();
	const action = dac
		.inputSchema(schema, {
			handleValidationErrorsShape: async (ve) => flattenValidationErrors(ve),
		})
		.action(async () => {
			returnValidationErrors(schema, {
				_errors: ["root_error"],
				username: { _errors: ["field_error"] },
			});
			return { ok: true };
		});

	const result = await action({ username: "test" });
	expect(result).toStrictEqual({
		validationErrors: {
			formErrors: ["root_error"],
			fieldErrors: {
				username: ["field_error"],
			},
		},
	});
});

test("returnValidationErrors from .action() when handleServerError rethrows still returns validationErrors", async () => {
	const action = ac.inputSchema(schema).action(async () => {
		returnValidationErrors(schema, {
			username: { _errors: ["already_taken"] },
		});
		return { ok: true };
	});

	const result = await action({ username: "test" });
	expect(result).toStrictEqual({
		validationErrors: {
			username: { _errors: ["already_taken"] },
		},
	});
});

test("returnValidationErrors from .action() propagates correctly through middleware stack", async () => {
	const dac = createSafeActionClient();
	const action = dac
		.use(async ({ next }) => {
			return next({ ctx: { fromMiddleware: true } });
		})
		.inputSchema(schema)
		.action(async () => {
			returnValidationErrors(schema, {
				username: { _errors: ["invalid_username"] },
			});
			return { ok: true };
		});

	const result = await action({ username: "test" });
	expect(result).toStrictEqual({
		validationErrors: {
			username: { _errors: ["invalid_username"] },
		},
	});
});

test("action returns data when returnValidationErrors condition is not met", async () => {
	const dac = createSafeActionClient();
	const action = dac.inputSchema(schema).action(async ({ parsedInput }) => {
		if (parsedInput.username === "banned") {
			returnValidationErrors(schema, {
				username: { _errors: ["user_banned"] },
			});
		}
		return { allowed: true };
	});

	const result = await action({ username: "gooduser" });
	expect(result).toStrictEqual({ data: { allowed: true } });
});

// --- `use cache` boundary tests (regression for issue #452) ---

// When `returnValidationErrors` is thrown inside a `'use cache'` scope, the
// `ActionServerValidationError` instance is serialized across the RSC boundary
// and the action engine receives a plain `Error` (no instance, no
// `validationErrors` property). It must still be recognized as a validation
// error via the `digest` channel and returned as `validationErrors`, not as a
// generic `DEFAULT_SERVER_ERROR_MESSAGE` server error.
test("returnValidationErrors thrown across a 'use cache' boundary returns validationErrors, not a server error", async () => {
	const dac = createSafeActionClient();
	const action = dac.inputSchema(schema).action(async () => {
		throwAsThroughUseCacheBoundary(() => returnValidationErrors(schema, { username: { _errors: ["already_taken"] } }));
		return { ok: true };
	});

	const result = await action({ username: "test" });
	expect(result).toStrictEqual({
		validationErrors: { username: { _errors: ["already_taken"] } },
	});
});

test("returnValidationErrors degraded across a 'use cache' boundary is recognized when thrown from a middleware", async () => {
	const dac = createSafeActionClient();
	const action = dac
		.use(async () => {
			throwAsThroughUseCacheBoundary(() =>
				returnValidationErrors(schema, { username: { _errors: ["from_middleware"] } })
			);
		})
		.inputSchema(schema)
		.action(async () => ({ ok: true }));

	const result = await action({ username: "test" });
	expect(result).toStrictEqual({
		validationErrors: { username: { _errors: ["from_middleware"] } },
	});
});

test("returnValidationErrors degraded across a 'use cache' boundary is recognized even when handleServerError rethrows", async () => {
	// `ac` is configured with handleServerError that rethrows. The digest detection must run
	// before the server-error guard, exactly like the in-memory instance path.
	const action = ac.inputSchema(schema).action(async () => {
		throwAsThroughUseCacheBoundary(() => returnValidationErrors(schema, { username: { _errors: ["already_taken"] } }));
		return { ok: true };
	});

	const result = await action({ username: "test" });
	expect(result).toStrictEqual({
		validationErrors: { username: { _errors: ["already_taken"] } },
	});
});

test("returnValidationErrors degraded across a 'use cache' boundary honors a custom validation errors shape (flattened)", async () => {
	const action = createSafeActionClient()
		.inputSchema(schema, {
			handleValidationErrorsShape: async (ve) => flattenValidationErrors(ve),
		})
		.action(async () => {
			throwAsThroughUseCacheBoundary(() =>
				returnValidationErrors(schema, {
					_errors: ["root_error"],
					username: { _errors: ["field_error"] },
				})
			);
			return { ok: true };
		});

	const result = await action({ username: "test" });
	expect(result).toStrictEqual({
		validationErrors: {
			formErrors: ["root_error"],
			fieldErrors: { username: ["field_error"] },
		},
	});
});

test("validation messages with delimiters and special characters survive the digest round-trip", async () => {
	const dac = createSafeActionClient();
	const tricky = 'has; a "quote", a\nnewline and unicode 日本語 \\ /';
	const action = dac.inputSchema(schema).action(async () => {
		throwAsThroughUseCacheBoundary(() => returnValidationErrors(schema, { username: { _errors: [tricky] } }));
		return { ok: true };
	});

	const result = await action({ username: "test" });
	expect(result).toStrictEqual({
		validationErrors: { username: { _errors: [tricky] } },
	});
});

test("a genuine server error carrying a Next.js-generated digest is NOT swallowed as validation errors", async () => {
	const dac = createSafeActionClient();
	const action = dac.inputSchema(schema).action(async () => {
		// Simulates a real crash inside `'use cache'`: Next.js attaches a hash digest unrelated
		// to our marker. It must surface as a server error, not be misread as validation errors.
		const err = new Error("database is down");
		(err as { digest?: string }).digest = "1234567890";
		throw err;
	});

	const result = await action({ username: "test" });
	expect(result).toStrictEqual({ serverError: DEFAULT_SERVER_ERROR_MESSAGE });
});

test("a malformed validation digest falls through to server error handling instead of crashing", async () => {
	const dac = createSafeActionClient();
	const action = dac.inputSchema(schema).action(async () => {
		const err = new Error("Server Action server validation error(s) occurred");
		(err as { digest?: string }).digest = "NEXT_SAFE_ACTION_SERVER_VALIDATION_ERROR;{not valid json";
		throw err;
	});

	const result = await action({ username: "test" });
	expect(result).toStrictEqual({ serverError: DEFAULT_SERVER_ERROR_MESSAGE });
});

// --- defaultValidationErrorsShape tests ---

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
