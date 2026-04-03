import { expect, test } from "vitest";
import { z } from "zod";
import { createSafeActionClient, createValidatedMiddleware, returnValidationErrors } from "..";

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

// ─── Deep merge across use() -> useValidated() boundary ──────────────

test("deep merge across use() and useValidated() with nested overlapping keys", async () => {
	const action = ac
		.use(async ({ next }) => {
			return next({ ctx: { permissions: { read: true, write: false } } });
		})
		.inputSchema(z.object({ role: z.string() }))
		.useValidated(async ({ parsedInput, next }) => {
			const extraPerms = parsedInput.role === "admin" ? { write: true, delete: true } : {};
			return next({ ctx: { permissions: extraPerms } });
		})
		.action(async ({ ctx }) => {
			return { permissions: ctx.permissions };
		});

	const actualResult = await action({ role: "admin" });

	// deepmerge recursively merges: read from use() survives, write is overridden, delete is added.
	expect(actualResult).toStrictEqual({
		data: {
			permissions: { read: true, write: true, delete: true },
		},
	});
});

test("deep merge arrays across use() and useValidated()", async () => {
	const action = ac
		.use(async ({ next }) => {
			return next({ ctx: { scopes: ["read:self"] } });
		})
		.inputSchema(z.object({ role: z.enum(["admin", "user"]) }))
		.useValidated(async ({ parsedInput, next }) => {
			const scopes = parsedInput.role === "admin" ? ["write:all", "delete:all"] : [];
			return next({ ctx: { scopes } });
		})
		.action(async ({ ctx }) => {
			return { scopes: ctx.scopes };
		});

	const actualResult = await action({ role: "admin" });

	// Arrays are concatenated by deepmerge-ts.
	expect(actualResult).toStrictEqual({
		data: {
			scopes: ["read:self", "write:all", "delete:all"],
		},
	});
});

// ─── Async schema function + useValidated() ──────────────────────────

test("useValidated works with async inputSchema function", async () => {
	let capturedClientInput: unknown;
	let capturedParsedInput: unknown;

	const action = ac
		.inputSchema(async () => z.string().transform((s) => s.trim().toLowerCase()))
		.useValidated(async ({ clientInput, parsedInput, next }) => {
			capturedClientInput = clientInput;
			capturedParsedInput = parsedInput;
			return next();
		})
		.action(async () => {
			return { ok: true };
		});

	await action("  HELLO  ");

	expect(capturedClientInput).toBe("  HELLO  ");
	expect(capturedParsedInput).toBe("hello");
});

// ─── Custom handleServerError shaping ────────────────────────────────

test("handleServerError shapes errors thrown in useValidated middleware", async () => {
	const acCustom = createSafeActionClient({
		handleServerError(e) {
			return {
				code: "MIDDLEWARE_ERROR",
				originalMessage: e.message,
				timestamp: "2024-01-01",
			};
		},
	});

	const action = acCustom
		.inputSchema(z.string())
		.useValidated(async () => {
			throw new Error("permission denied");
		})
		.action(async () => {
			return { ok: true };
		});

	const result = await action("hello");

	expect(result).toStrictEqual({
		serverError: {
			code: "MIDDLEWARE_ERROR",
			originalMessage: "permission denied",
			timestamp: "2024-01-01",
		},
	});
});

// ─── Auth middleware pattern (production-critical) ────────────────────

test("auth pattern: use() authenticates, useValidated() authorizes based on input", async () => {
	const acAuth = createSafeActionClient({
		handleServerError(e) {
			return e.message;
		},
	}).use(async ({ next }) => {
		// Simulate authentication: fetch user from session/token.
		const user = { id: "user-1", role: "editor" as const };
		return next({ ctx: { user } });
	});

	const action = acAuth
		.inputSchema(z.object({ resourceId: z.string(), requiredRole: z.enum(["viewer", "editor", "admin"]) }))
		.useValidated(async ({ ctx, parsedInput, next }) => {
			// Authorization: check if user role matches required role.
			const roleHierarchy = { viewer: 0, editor: 1, admin: 2 } as const;
			const userLevel = roleHierarchy[ctx.user.role];
			const requiredLevel = roleHierarchy[parsedInput.requiredRole];

			if (userLevel < requiredLevel) {
				throw new Error(`Insufficient permissions: requires ${parsedInput.requiredRole}, has ${ctx.user.role}`);
			}

			return next({ ctx: { authorized: true } });
		})
		.action(async ({ ctx }) => {
			return { userId: ctx.user.id, authorized: ctx.authorized };
		});

	// Editor accessing editor-level resource: success.
	const successResult = await action({ resourceId: "doc-1", requiredRole: "editor" });
	expect(successResult).toStrictEqual({
		data: { userId: "user-1", authorized: true },
	});

	// Editor accessing admin-level resource: failure.
	const failResult = await action({ resourceId: "doc-1", requiredRole: "admin" });
	expect(failResult).toStrictEqual({
		serverError: "Insufficient permissions: requires admin, has editor",
	});
});

test("auth pattern: useValidated() blocks action when authorization fails", async () => {
	let actionExecuted = false;

	const acAuth = createSafeActionClient({
		handleServerError(e) {
			return e.message;
		},
	}).use(async ({ next }) => {
		return next({ ctx: { userId: "user-1", isAdmin: false } });
	});

	const action = acAuth
		.inputSchema(z.object({ action: z.enum(["read", "delete"]) }))
		.useValidated(async ({ ctx, parsedInput, next }) => {
			if (parsedInput.action === "delete" && !ctx.isAdmin) {
				throw new Error("Only admins can delete");
			}
			return next();
		})
		.action(async () => {
			actionExecuted = true;
			return { ok: true };
		});

	await action({ action: "delete" });
	expect(actionExecuted).toBe(false);

	await action({ action: "read" });
	expect(actionExecuted).toBe(true);
});

// ─── Logging/timing middleware pattern ───────────────────────────────

test("logging pattern: use() wraps timing, useValidated() logs parsed input", async () => {
	const log: string[] = [];

	const acLogging = createSafeActionClient({
		handleServerError(e) {
			return e.message;
		},
	}).use(async ({ next }) => {
		log.push("timing:start");
		const res = await next();
		log.push(`timing:end:success=${res.success}`);
		return res;
	});

	const action = acLogging
		.inputSchema(z.object({ query: z.string() }))
		.useValidated(async ({ parsedInput, next }) => {
			log.push(`input:query=${parsedInput.query}`);
			return next();
		})
		.action(async () => {
			log.push("action:execute");
			return { ok: true };
		});

	await action({ query: "test" });

	expect(log).toStrictEqual(["timing:start", "input:query=test", "action:execute", "timing:end:success=true"]);
});

test("logging pattern: timing middleware captures failure from validated middleware", async () => {
	const log: string[] = [];

	const acLogging = createSafeActionClient({
		handleServerError(e) {
			return e.message;
		},
	}).use(async ({ next }) => {
		log.push("timing:start");
		const res = await next();
		log.push(`timing:end:success=${res.success}`);
		return res;
	});

	const action = acLogging
		.inputSchema(z.string())
		.useValidated(async () => {
			log.push("validated:about-to-throw");
			throw new Error("forbidden");
		})
		.action(async () => {
			log.push("action:should-not-run");
			return { ok: true };
		});

	await action("test");

	expect(log).toStrictEqual(["timing:start", "validated:about-to-throw", "timing:end:success=false"]);
});

// ─── Role-based access with returnValidationErrors ───────────────────

test("role-based access: useValidated() returns validation errors for unauthorized fields", async () => {
	const schema = z.object({
		email: z.string().email(),
		role: z.enum(["user", "admin"]),
	});

	const acRbac = createSafeActionClient({
		handleServerError(e) {
			return e.message;
		},
	}).use(async ({ next }) => {
		return next({ ctx: { currentUserRole: "user" as "user" | "admin" } });
	});

	const action = acRbac
		.inputSchema(schema)
		.useValidated(async ({ ctx, parsedInput, next }) => {
			if (parsedInput.role === "admin" && ctx.currentUserRole !== "admin") {
				returnValidationErrors(schema, {
					role: { _errors: ["You cannot assign admin role"] },
				});
			}
			return next();
		})
		.action(async ({ parsedInput }) => {
			return { email: parsedInput.email, role: parsedInput.role };
		});

	const failResult = await action({ email: "user@test.com", role: "admin" });
	expect(failResult).toHaveProperty("validationErrors");
	expect(failResult.validationErrors).toStrictEqual({
		role: { _errors: ["You cannot assign admin role"] },
	});

	const successResult = await action({ email: "user@test.com", role: "user" });
	expect(successResult).toStrictEqual({
		data: { email: "user@test.com", role: "user" },
	});
});

// ─── Multiple useValidated() layered authorization ───────────────────

test("multiple useValidated() middleware run in sequence for layered authorization", async () => {
	const checks: string[] = [];

	const action = ac
		.inputSchema(z.object({ resourceId: z.string(), action: z.enum(["read", "write"]) }))
		.useValidated(async ({ parsedInput, next }) => {
			// First layer: resource existence check.
			checks.push(`check:resource=${parsedInput.resourceId}`);
			if (parsedInput.resourceId === "deleted-1") {
				throw new Error("Resource not found");
			}
			return next({ ctx: { resourceVerified: true } });
		})
		.useValidated(async ({ parsedInput, ctx, next }) => {
			// Second layer: action permission check.
			checks.push(`check:action=${parsedInput.action}:verified=${ctx.resourceVerified}`);
			if (parsedInput.action === "write") {
				throw new Error("Read-only resource");
			}
			return next({ ctx: { actionPermitted: true } });
		})
		.action(async ({ ctx }) => {
			return { resourceVerified: ctx.resourceVerified, actionPermitted: ctx.actionPermitted };
		});

	// Both checks pass.
	const okResult = await action({ resourceId: "doc-1", action: "read" });
	expect(okResult).toStrictEqual({
		data: { resourceVerified: true, actionPermitted: true },
	});
	expect(checks).toStrictEqual(["check:resource=doc-1", "check:action=read:verified=true"]);

	// First check fails: second never runs.
	checks.length = 0;
	const failFirstResult = await action({ resourceId: "deleted-1", action: "read" });
	expect(failFirstResult).toStrictEqual({ serverError: "Resource not found" });
	expect(checks).toStrictEqual(["check:resource=deleted-1"]);

	// First passes, second fails.
	checks.length = 0;
	const failSecondResult = await action({ resourceId: "doc-1", action: "write" });
	expect(failSecondResult).toStrictEqual({ serverError: "Read-only resource" });
	expect(checks).toStrictEqual(["check:resource=doc-1", "check:action=write:verified=true"]);
});

// ─── Context from useValidated() in action callbacks ─────────────────

test("onSuccess callback receives context set by useValidated()", async () => {
	let callbackCtx: unknown;

	const action = ac
		.inputSchema(z.string())
		.useValidated(async ({ next }) => {
			return next({ ctx: { validatedAt: "2024-01-01" } });
		})
		.action(
			async () => {
				return { ok: true };
			},
			{
				onSuccess: async ({ ctx }) => {
					callbackCtx = ctx;
				},
			}
		);

	await action("hello");

	expect(callbackCtx).toStrictEqual({ validatedAt: "2024-01-01" });
});

test("onError callback receives partial context when useValidated() was not reached", async () => {
	let callbackCtx: unknown;
	let callbackCalled = false;

	const acWithCtx = createSafeActionClient({
		handleServerError(e) {
			return e.message;
		},
	}).use(async ({ next }) => {
		return next({ ctx: { baseCtx: "always-set" } });
	});

	const action = acWithCtx
		.inputSchema(z.string().min(5))
		.useValidated(async ({ next }) => {
			return next({ ctx: { validatedCtx: "only-after-validation" } });
		})
		.action(
			async () => {
				return { ok: true };
			},
			{
				onError: async ({ ctx }) => {
					callbackCalled = true;
					callbackCtx = ctx;
				},
			}
		);

	// Input validation fails, so useValidated() never runs.
	await action("ab");

	expect(callbackCalled).toBe(true);
	// Base context is present, validated context is missing.
	expect(callbackCtx).toStrictEqual({ baseCtx: "always-set" });
});

test("onSettled callback receives full context on success", async () => {
	let settledCtx: unknown;

	const action = ac
		.inputSchema(z.string())
		.useValidated(async ({ next }) => {
			return next({ ctx: { enriched: true } });
		})
		.action(
			async () => {
				return { ok: true };
			},
			{
				onSettled: async ({ ctx }) => {
					settledCtx = ctx;
				},
			}
		);

	await action("hello");

	expect(settledCtx).toStrictEqual({ enriched: true });
});

// ─── useValidated() post-processing ──────────────────────────────────

test("useValidated middleware can post-process after awaiting next()", async () => {
	const log: string[] = [];

	const action = ac
		.inputSchema(z.string())
		.useValidated(async ({ parsedInput, next }) => {
			log.push(`pre:${parsedInput}`);
			const res = await next();
			log.push(`post:success=${res.success}`);
			return res;
		})
		.action(async () => {
			log.push("action");
			return { ok: true };
		});

	await action("test");

	expect(log).toStrictEqual(["pre:test", "action", "post:success=true"]);
});

// ─── Bind args transform ─────────────────────────────────────────────

test("useValidated receives transformed bind args while client inputs stay raw", async () => {
	let capturedBindArgsParsed: unknown;
	let capturedBindArgsClient: unknown;

	const action = ac
		.inputSchema(z.string())
		.bindArgsSchemas([z.string().transform((s) => s.toUpperCase()), z.number().transform((n) => n * 2)])
		.useValidated(async ({ bindArgsParsedInputs, bindArgsClientInputs, next }) => {
			capturedBindArgsParsed = bindArgsParsedInputs;
			capturedBindArgsClient = bindArgsClientInputs;
			return next();
		})
		.action(async () => {
			return { ok: true };
		});

	await action("hello", 5, "main-input");

	expect(capturedBindArgsClient).toStrictEqual(["hello", 5]);
	expect(capturedBindArgsParsed).toStrictEqual(["HELLO", 10]);
});

// ─── Interleaved execution order ─────────────────────────────────────

test("complex interleaved use() + useValidated() execution order", async () => {
	const order: string[] = [];

	const action = ac
		.use(async ({ next }) => {
			order.push("use-1:before");
			const res = await next();
			order.push("use-1:after");
			return res;
		})
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(async ({ next }) => {
			order.push("validated-1:before");
			const res = await next();
			order.push("validated-1:after");
			return res;
		})
		.use(async ({ next }) => {
			order.push("use-2:before");
			const res = await next();
			order.push("use-2:after");
			return res;
		})
		.useValidated(async ({ next }) => {
			order.push("validated-2:before");
			const res = await next();
			order.push("validated-2:after");
			return res;
		})
		.action(async () => {
			order.push("action");
			return { ok: true };
		});

	await action({ name: "test" });

	// use() middleware runs pre-validation (collected into one stack),
	// useValidated() runs post-validation (in their own stack).
	// Both stacks follow onion order.
	expect(order).toStrictEqual([
		"use-1:before",
		"use-2:before",
		"validated-1:before",
		"validated-2:before",
		"action",
		"validated-2:after",
		"validated-1:after",
		"use-2:after",
		"use-1:after",
	]);
});

// ─── Standalone validated middleware edge cases ───────────────────────

test("createValidatedMiddleware receives context from upstream use()", async () => {
	const standaloneAuth = createValidatedMiddleware<{
		parsedInput: { action: string };
		ctx: { userId: string };
	}>().define(async ({ parsedInput, ctx, next }) => {
		return next({ ctx: { auditLog: `${ctx.userId}:${parsedInput.action}` } });
	});

	const acWithUser = createSafeActionClient({
		handleServerError(e) {
			return e.message;
		},
	}).use(async ({ next }) => {
		return next({ ctx: { userId: "user-42" } });
	});

	const action = acWithUser
		.inputSchema(z.object({ action: z.string() }))
		.useValidated(standaloneAuth)
		.action(async ({ ctx }) => {
			return { auditLog: ctx.auditLog };
		});

	const result = await action({ action: "delete" });
	expect(result).toStrictEqual({
		data: { auditLog: "user-42:delete" },
	});
});
