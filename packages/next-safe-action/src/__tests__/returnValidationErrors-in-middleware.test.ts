/* eslint-disable @typescript-eslint/no-floating-promises */

import assert from "node:assert";
import { test } from "node:test";
import { z } from "zod";
import { createSafeActionClient, returnValidationErrors } from "..";

// Simulates a domain-layer error class (e.g. a unique constraint violation).
class FieldError extends Error {
	constructor(
		public readonly field: string,
		public readonly description: string
	) {
		super(description);
	}
}

// Mirrors the pattern used in apps that configure handleServerError to rethrow,
// relying on a middleware to convert known domain errors into validation errors.
const ac = createSafeActionClient({
	handleServerError(e) {
		throw e;
	},
});

const schema = z.object({ username: z.string().min(3) });

// The middleware catches known domain errors and converts them to validation
// errors via returnValidationErrors, exactly as documented. The bug causes
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

// BUG REPRO: This test demonstrates that when returnValidationErrors is called
// from a middleware catch block (after a domain error is thrown from server
// code and handleServerError is configured to rethrow), the resulting
// ActionServerValidationError escapes the action builder unhandled — causing
// an unhandled rejection on the server and an error boundary hit on the client.
//
// Expected: { validationErrors: { username: { _errors: ["Username is already taken"] } } }
// Actual:   Throws "Error: Server Action server validation error(s) occurred"
test("returnValidationErrors called from a middleware catch block returns validationErrors on the result (not a thrown error)", async () => {
	const result = await actionWithErrorMiddleware({ username: "taken" });
	const expected = {
		validationErrors: {
			username: { _errors: ["Username is already taken"] },
		},
	};
	assert.deepStrictEqual(result, expected);
});

// Sanity-check: when no domain error is thrown, the action succeeds normally.
test("action succeeds normally when no domain error is thrown", async () => {
	const result = await actionWithErrorMiddleware({ username: "available" });
	assert.deepStrictEqual(result, { data: { ok: true } });
});

// Sanity-check: unknown errors that the middleware does not handle are still
// forwarded through handleServerError and, when rethrown, reject the action.
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
	await assert.rejects(() => actionThatThrows({ username: "foo" }));
});
