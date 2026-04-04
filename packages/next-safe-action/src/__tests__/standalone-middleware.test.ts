import { redirect } from "next/navigation";
import { expect, test } from "vitest";
import { z } from "zod";
import { createMiddleware, createSafeActionClient, createValidatedMiddleware, returnValidationErrors } from "..";
import { FrameworkErrorHandler } from "../next/errors";

// ═══════════════════════════════════════════════════════════════════════
// createMiddleware() runtime tests
// ═══════════════════════════════════════════════════════════════════════

const ac = createSafeActionClient({
	handleServerError(e) {
		return e.message;
	},
});

// ─── Basic usage ────────────────────────────────────────────────────

test("createMiddleware with no constraints extends context", async () => {
	const mw = createMiddleware().define(async ({ next }) => {
		return next({ ctx: { added: true } });
	});

	const action = ac.use(mw).action(async ({ ctx }) => {
		return { added: ctx.added };
	});

	const result = await action();
	expect(result).toStrictEqual({ data: { added: true } });
});

test("createMiddleware with ctx constraint receives and passes context", async () => {
	const mw = createMiddleware<{ ctx: { userId: string } }>().define(async ({ ctx, next }) => {
		return next({ ctx: { greeting: `hello ${ctx.userId}` } });
	});

	const action = ac
		.use(async ({ next }) => next({ ctx: { userId: "user-1" } }))
		.use(mw)
		.action(async ({ ctx }) => {
			return { greeting: ctx.greeting, userId: ctx.userId };
		});

	const result = await action();
	expect(result).toStrictEqual({
		data: { greeting: "hello user-1", userId: "user-1" },
	});
});

test("createMiddleware with metadata constraint accesses metadata", async () => {
	const mw = createMiddleware<{ metadata: { actionName: string } }>().define(async ({ metadata, next }) => {
		return next({ ctx: { loggedAction: metadata.actionName } });
	});

	const acWithMeta = createSafeActionClient({
		handleServerError: (e) => e.message,
		defineMetadataSchema: () => z.object({ actionName: z.string() }),
	}).use(mw);

	const action = acWithMeta.metadata({ actionName: "testAction" }).action(async ({ ctx }) => {
		return { loggedAction: ctx.loggedAction };
	});

	const result = await action();
	expect(result).toStrictEqual({ data: { loggedAction: "testAction" } });
});

test("createMiddleware with serverError constraint works in chain", async () => {
	const mw = createMiddleware<{ serverError: string }>().define(async ({ next }) => {
		const result = await next();
		return result;
	});

	const action = ac.use(mw).action(async () => {
		return { ok: true };
	});

	const result = await action();
	expect(result).toStrictEqual({ data: { ok: true } });
});

test("createMiddleware with all constraints simultaneously", async () => {
	const mw = createMiddleware<{
		serverError: string;
		ctx: { userId: string };
		metadata: { actionName: string };
	}>().define(async ({ ctx, metadata, next }) => {
		return next({ ctx: { tag: `${ctx.userId}:${metadata.actionName}` } });
	});

	const acWithMeta = createSafeActionClient({
		handleServerError: (e) => e.message,
		defineMetadataSchema: () => z.object({ actionName: z.string() }),
	})
		.use(async ({ next }) => next({ ctx: { userId: "u1" } }))
		.use(mw);

	const action = acWithMeta.metadata({ actionName: "myAction" }).action(async ({ ctx }) => {
		return { tag: ctx.tag };
	});

	const result = await action();
	expect(result).toStrictEqual({ data: { tag: "u1:myAction" } });
});

// ─── Error handling ─────────────────────────────────────────────────

test("createMiddleware error propagates as serverError", async () => {
	const mw = createMiddleware().define(async () => {
		throw new Error("standalone middleware error");
	});

	const action = ac.use(mw).action(async () => {
		return { ok: true };
	});

	const result = await action();
	expect(result).toStrictEqual({ serverError: "standalone middleware error" });
});

test("createMiddleware async error propagates as serverError", async () => {
	const mw = createMiddleware().define(async () => {
		await Promise.resolve();
		throw new Error("async standalone error");
	});

	const action = ac.use(mw).action(async () => {
		return { ok: true };
	});

	const result = await action();
	expect(result).toStrictEqual({ serverError: "async standalone error" });
});

test("createMiddleware framework error (redirect) propagates", async () => {
	const mw = createMiddleware().define(async () => {
		redirect("/somewhere");
	});

	const action = ac.use(mw).action(async () => {
		return { ok: true };
	});

	try {
		await action();
		expect.unreachable("Expected a framework error to be thrown");
	} catch (e) {
		expect(FrameworkErrorHandler.isNavigationError(e)).toBe(true);
	}
});

// ─── Post-processing (onion model) ─────────────────────────────────

test("createMiddleware can post-process after awaiting next()", async () => {
	const sideEffects: string[] = [];

	const mw = createMiddleware().define(async ({ next }) => {
		sideEffects.push("mw-before");
		const result = await next();
		sideEffects.push("mw-after");
		return result;
	});

	const action = ac.use(mw).action(async () => {
		sideEffects.push("action");
		return { ok: true };
	});

	await action();
	expect(sideEffects).toStrictEqual(["mw-before", "action", "mw-after"]);
});

test("createMiddleware inspects result after action execution", async () => {
	let capturedResult: unknown;

	const mw = createMiddleware().define(async ({ next }) => {
		const result = await next();
		capturedResult = result;
		return result;
	});

	const action = ac.use(mw).action(async () => {
		return { value: 42 };
	});

	await action();
	expect(capturedResult).toMatchObject({
		success: true,
		data: { value: 42 },
	});
});

test("createMiddleware inspects error result from action", async () => {
	let capturedResult: unknown;

	const mw = createMiddleware().define(async ({ next }) => {
		const result = await next();
		capturedResult = result;
		return result;
	});

	const action = ac.use(mw).action(async () => {
		throw new Error("action failed");
	});

	await action();
	expect(capturedResult).toMatchObject({
		success: false,
		serverError: "action failed",
	});
});

// ─── Chaining multiple standalone middleware ────────────────────────

test("multiple createMiddleware instances chain correctly", async () => {
	const order: string[] = [];

	const mw1 = createMiddleware().define(async ({ next }) => {
		order.push("mw1-before");
		const result = await next({ ctx: { a: 1 } });
		order.push("mw1-after");
		return result;
	});

	const mw2 = createMiddleware().define(async ({ next }) => {
		order.push("mw2-before");
		const result = await next({ ctx: { b: 2 } });
		order.push("mw2-after");
		return result;
	});

	const action = ac
		.use(mw1)
		.use(mw2)
		.action(async ({ ctx }) => {
			order.push("action");
			return { a: ctx.a, b: ctx.b };
		});

	const result = await action();
	expect(result).toStrictEqual({ data: { a: 1, b: 2 } });
	expect(order).toStrictEqual(["mw1-before", "mw2-before", "action", "mw2-after", "mw1-after"]);
});

test("standalone middleware followed by inline middleware accumulates context", async () => {
	const standalone = createMiddleware().define(async ({ next }) => {
		return next({ ctx: { fromStandalone: true } });
	});

	const action = ac
		.use(standalone)
		.use(async ({ next }) => {
			return next({ ctx: { fromInline: true } });
		})
		.action(async ({ ctx }) => {
			return { fromStandalone: ctx.fromStandalone, fromInline: ctx.fromInline };
		});

	const result = await action();
	expect(result).toStrictEqual({
		data: { fromStandalone: true, fromInline: true },
	});
});

// ─── Deep merge behavior ────────────────────────────────────────────

test("standalone middleware context deep merges nested objects", async () => {
	const mw1 = createMiddleware().define(async ({ next }) => {
		return next({ ctx: { config: { timeout: 5000, retries: 3 } } });
	});

	const mw2 = createMiddleware().define(async ({ next }) => {
		return next({ ctx: { config: { timeout: 10000 } } });
	});

	const action = ac
		.use(mw1)
		.use(mw2)
		.action(async ({ ctx }) => {
			return { config: ctx.config };
		});

	const result = await action();
	expect(result).toStrictEqual({
		data: { config: { timeout: 10000, retries: 3 } },
	});
});

test("standalone middleware context deep merges arrays", async () => {
	const mw1 = createMiddleware().define(async ({ next }) => {
		return next({ ctx: { tags: ["auth"] } });
	});

	const mw2 = createMiddleware().define(async ({ next }) => {
		return next({ ctx: { tags: ["logging"] } });
	});

	const action = ac
		.use(mw1)
		.use(mw2)
		.action(async ({ ctx }) => {
			return { tags: ctx.tags };
		});

	const result = await action();
	expect(result).toStrictEqual({
		data: { tags: ["auth", "logging"] },
	});
});

// ─── Client input access ────────────────────────────────────────────

test("createMiddleware accesses raw clientInput and bindArgsClientInputs", async () => {
	let capturedClientInput: unknown;
	let capturedBindArgs: unknown;

	const mw = createMiddleware().define(async ({ clientInput, bindArgsClientInputs, next }) => {
		capturedClientInput = clientInput;
		capturedBindArgs = bindArgsClientInputs;
		return next();
	});

	const action = ac
		.use(mw)
		.inputSchema(z.object({ name: z.string() }))
		.bindArgsSchemas([z.number()])
		.action(async () => {
			return { ok: true };
		});

	await action(42, { name: "test" });
	expect(capturedClientInput).toStrictEqual({ name: "test" });
	expect(capturedBindArgs).toStrictEqual([42]);
});

// ═══════════════════════════════════════════════════════════════════════
// createValidatedMiddleware() runtime tests
// ═══════════════════════════════════════════════════════════════════════

// ─── Basic usage ────────────────────────────────────────────────────

test("createValidatedMiddleware with no constraints extends context", async () => {
	const mw = createValidatedMiddleware().define(async ({ next }) => {
		return next({ ctx: { validated: true } });
	});

	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(mw)
		.action(async ({ ctx }) => {
			return { validated: ctx.validated };
		});

	const result = await action({ name: "test" });
	expect(result).toStrictEqual({ data: { validated: true } });
});

test("createValidatedMiddleware with parsedInput constraint receives typed input", async () => {
	const mw = createValidatedMiddleware<{
		parsedInput: { name: string };
	}>().define(async ({ parsedInput, next }) => {
		return next({ ctx: { upperName: parsedInput.name.toUpperCase() } });
	});

	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(mw)
		.action(async ({ ctx }) => {
			return { upperName: ctx.upperName };
		});

	const result = await action({ name: "hello" });
	expect(result).toStrictEqual({ data: { upperName: "HELLO" } });
});

test("createValidatedMiddleware with ctx constraint receives upstream context", async () => {
	const mw = createValidatedMiddleware<{
		ctx: { userId: string };
		parsedInput: { postId: string };
	}>().define(async ({ ctx, parsedInput, next }) => {
		return next({ ctx: { audit: `${ctx.userId} accessed ${parsedInput.postId}` } });
	});

	const action = ac
		.use(async ({ next }) => next({ ctx: { userId: "user-99" } }))
		.inputSchema(z.object({ postId: z.string() }))
		.useValidated(mw)
		.action(async ({ ctx }) => {
			return { audit: ctx.audit };
		});

	const result = await action({ postId: "post-1" });
	expect(result).toStrictEqual({ data: { audit: "user-99 accessed post-1" } });
});

test("createValidatedMiddleware with metadata constraint accesses metadata", async () => {
	const mw = createValidatedMiddleware<{
		metadata: { actionName: string };
		parsedInput: { value: string };
	}>().define(async ({ metadata, parsedInput, next }) => {
		return next({ ctx: { log: `${metadata.actionName}:${parsedInput.value}` } });
	});

	const acWithMeta = createSafeActionClient({
		handleServerError: (e) => e.message,
		defineMetadataSchema: () => z.object({ actionName: z.string() }),
	});

	const action = acWithMeta
		.metadata({ actionName: "myAction" })
		.inputSchema(z.object({ value: z.string() }))
		.useValidated(mw)
		.action(async ({ ctx }) => {
			return { log: ctx.log };
		});

	const result = await action({ value: "test" });
	expect(result).toStrictEqual({ data: { log: "myAction:test" } });
});

test("createValidatedMiddleware with all constraints simultaneously", async () => {
	const mw = createValidatedMiddleware<{
		serverError: string;
		ctx: { userId: string };
		metadata: { actionName: string };
		parsedInput: { item: string };
		clientInput: { item: string };
		bindArgsParsedInputs: readonly [number];
		bindArgsClientInputs: readonly [number];
	}>().define(async ({ ctx, metadata, parsedInput, clientInput, bindArgsParsedInputs, bindArgsClientInputs, next }) => {
		return next({
			ctx: {
				summary: {
					user: ctx.userId,
					action: metadata.actionName,
					parsed: parsedInput.item,
					raw: clientInput.item,
					bindParsed: bindArgsParsedInputs[0],
					bindRaw: bindArgsClientInputs[0],
				},
			},
		});
	});

	const acWithMeta = createSafeActionClient({
		handleServerError: (e) => e.message,
		defineMetadataSchema: () => z.object({ actionName: z.string() }),
	}).use(async ({ next }) => next({ ctx: { userId: "u1" } }));

	const action = acWithMeta
		.metadata({ actionName: "fullTest" })
		.inputSchema(z.object({ item: z.string() }))
		.bindArgsSchemas([z.number()])
		.useValidated(mw)
		.action(async ({ ctx }) => {
			return { summary: ctx.summary };
		});

	const result = await action(42, { item: "widget" });
	expect(result).toStrictEqual({
		data: {
			summary: {
				user: "u1",
				action: "fullTest",
				parsed: "widget",
				raw: "widget",
				bindParsed: 42,
				bindRaw: 42,
			},
		},
	});
});

// ─── Schema transforms ─────────────────────────────────────────────

test("createValidatedMiddleware sees transformed parsedInput and raw clientInput", async () => {
	let capturedParsed: unknown;
	let capturedRaw: unknown;

	const mw = createValidatedMiddleware().define(async ({ parsedInput, clientInput, next }) => {
		capturedParsed = parsedInput;
		capturedRaw = clientInput;
		return next();
	});

	const action = ac
		.inputSchema(z.string().transform((s) => s.toUpperCase()))
		.useValidated(mw)
		.action(async () => {
			return { ok: true };
		});

	await action("hello");
	expect(capturedParsed).toBe("HELLO");
	expect(capturedRaw).toBe("hello");
});

test("createValidatedMiddleware sees transformed bind args", async () => {
	let capturedBindParsed: unknown;
	let capturedBindRaw: unknown;

	const mw = createValidatedMiddleware().define(async ({ bindArgsParsedInputs, bindArgsClientInputs, next }) => {
		capturedBindParsed = bindArgsParsedInputs;
		capturedBindRaw = bindArgsClientInputs;
		return next();
	});

	const action = ac
		.inputSchema(z.string())
		.bindArgsSchemas([z.string().transform((s) => parseInt(s, 10))])
		.useValidated(mw)
		.action(async () => {
			return { ok: true };
		});

	await action("42", "hello");
	expect(capturedBindParsed).toStrictEqual([42]);
	expect(capturedBindRaw).toStrictEqual(["42"]);
});

// ─── Validation failure skipping ────────────────────────────────────

test("createValidatedMiddleware is skipped when validation fails", async () => {
	let middlewareCalled = false;

	const mw = createValidatedMiddleware().define(async ({ next }) => {
		middlewareCalled = true;
		return next();
	});

	const action = ac
		.inputSchema(z.object({ name: z.string().min(5) }))
		.useValidated(mw)
		.action(async () => {
			return { ok: true };
		});

	const result = await action({ name: "ab" });
	expect(middlewareCalled).toBe(false);
	expect(result).toHaveProperty("validationErrors");
});

test("createValidatedMiddleware is skipped when bind args validation fails", async () => {
	let middlewareCalled = false;

	const mw = createValidatedMiddleware().define(async ({ next }) => {
		middlewareCalled = true;
		return next();
	});

	const action = ac
		.inputSchema(z.string())
		.bindArgsSchemas([z.number().min(10)])
		.useValidated(mw)
		.action(async () => {
			return { ok: true };
		});

	const result = await action(1, "hello");
	expect(middlewareCalled).toBe(false);
	expect(result).toHaveProperty("serverError");
});

// ─── Error handling ─────────────────────────────────────────────────

test("createValidatedMiddleware error propagates as serverError", async () => {
	const mw = createValidatedMiddleware().define(async () => {
		throw new Error("validated standalone error");
	});

	const action = ac
		.inputSchema(z.string())
		.useValidated(mw)
		.action(async () => {
			return { ok: true };
		});

	const result = await action("test");
	expect(result).toStrictEqual({ serverError: "validated standalone error" });
});

test("createValidatedMiddleware framework error (redirect) propagates", async () => {
	const mw = createValidatedMiddleware().define(async () => {
		redirect("/somewhere");
	});

	const action = ac
		.inputSchema(z.string())
		.useValidated(mw)
		.action(async () => {
			return { ok: true };
		});

	try {
		await action("test");
		expect.unreachable("Expected a framework error to be thrown");
	} catch (e) {
		expect(FrameworkErrorHandler.isNavigationError(e)).toBe(true);
	}
});

test("createValidatedMiddleware can call returnValidationErrors", async () => {
	const schema = z.object({ email: z.string() });

	const mw = createValidatedMiddleware<{
		parsedInput: { email: string };
	}>().define(async ({ parsedInput, next }) => {
		if (!parsedInput.email.includes("@")) {
			returnValidationErrors(schema, {
				email: { _errors: ["Must be a valid email address"] },
			});
		}
		return next();
	});

	const action = ac
		.inputSchema(schema)
		.useValidated(mw)
		.action(async () => {
			return { ok: true };
		});

	const result = await action({ email: "notanemail" });
	expect(result).toStrictEqual({
		validationErrors: {
			email: { _errors: ["Must be a valid email address"] },
		},
	});
});

// ─── Post-processing (onion model) ─────────────────────────────────

test("createValidatedMiddleware can post-process after awaiting next()", async () => {
	const sideEffects: string[] = [];

	const mw = createValidatedMiddleware().define(async ({ next }) => {
		sideEffects.push("validated-mw-before");
		const result = await next();
		sideEffects.push("validated-mw-after");
		return result;
	});

	const action = ac
		.inputSchema(z.string())
		.useValidated(mw)
		.action(async () => {
			sideEffects.push("action");
			return { ok: true };
		});

	await action("test");
	expect(sideEffects).toStrictEqual(["validated-mw-before", "action", "validated-mw-after"]);
});

test("createValidatedMiddleware inspects success result", async () => {
	let capturedResult: unknown;

	const mw = createValidatedMiddleware().define(async ({ next }) => {
		const result = await next();
		capturedResult = result;
		return result;
	});

	const action = ac
		.inputSchema(z.string())
		.useValidated(mw)
		.action(async () => {
			return { value: 42 };
		});

	await action("test");
	expect(capturedResult).toMatchObject({
		success: true,
		data: { value: 42 },
	});
});

test("createValidatedMiddleware inspects error result from action", async () => {
	let capturedResult: unknown;

	const mw = createValidatedMiddleware().define(async ({ next }) => {
		const result = await next();
		capturedResult = result;
		return result;
	});

	const action = ac
		.inputSchema(z.string())
		.useValidated(mw)
		.action(async () => {
			throw new Error("action failed");
		});

	await action("test");
	expect(capturedResult).toMatchObject({
		success: false,
		serverError: "action failed",
	});
});

// ─── Chaining multiple standalone validated middleware ───────────────

test("multiple createValidatedMiddleware instances chain correctly", async () => {
	const order: string[] = [];

	const mw1 = createValidatedMiddleware().define(async ({ next }) => {
		order.push("vmw1-before");
		const result = await next({ ctx: { first: true } });
		order.push("vmw1-after");
		return result;
	});

	const mw2 = createValidatedMiddleware().define(async ({ next }) => {
		order.push("vmw2-before");
		const result = await next({ ctx: { second: true } });
		order.push("vmw2-after");
		return result;
	});

	const action = ac
		.inputSchema(z.string())
		.useValidated(mw1)
		.useValidated(mw2)
		.action(async ({ ctx }) => {
			order.push("action");
			return { first: ctx.first, second: ctx.second };
		});

	const result = await action("test");
	expect(result).toStrictEqual({ data: { first: true, second: true } });
	expect(order).toStrictEqual(["vmw1-before", "vmw2-before", "action", "vmw2-after", "vmw1-after"]);
});

test("standalone validated middleware followed by inline useValidated accumulates context", async () => {
	const standalone = createValidatedMiddleware().define(async ({ next }) => {
		return next({ ctx: { fromStandalone: true } });
	});

	const action = ac
		.inputSchema(z.string())
		.useValidated(standalone)
		.useValidated(async ({ next }) => {
			return next({ ctx: { fromInline: true } });
		})
		.action(async ({ ctx }) => {
			return { fromStandalone: ctx.fromStandalone, fromInline: ctx.fromInline };
		});

	const result = await action("test");
	expect(result).toStrictEqual({
		data: { fromStandalone: true, fromInline: true },
	});
});

// ─── Deep merge behavior ────────────────────────────────────────────

test("standalone validated middleware context deep merges nested objects", async () => {
	const mw1 = createValidatedMiddleware().define(async ({ next }) => {
		return next({ ctx: { config: { timeout: 5000, retries: 3 } } });
	});

	const mw2 = createValidatedMiddleware().define(async ({ next }) => {
		return next({ ctx: { config: { timeout: 10000 } } });
	});

	const action = ac
		.inputSchema(z.string())
		.useValidated(mw1)
		.useValidated(mw2)
		.action(async ({ ctx }) => {
			return { config: ctx.config };
		});

	const result = await action("test");
	expect(result).toStrictEqual({
		data: { config: { timeout: 10000, retries: 3 } },
	});
});

// ─── Mixed standalone use() + useValidated() ────────────────────────

test("standalone createMiddleware and createValidatedMiddleware compose in full pipeline", async () => {
	const order: string[] = [];

	const preMiddleware = createMiddleware().define(async ({ next }) => {
		order.push("pre-mw");
		const result = await next({ ctx: { userId: "u1" } });
		order.push("pre-mw-after");
		return result;
	});

	const postMiddleware = createValidatedMiddleware<{
		ctx: { userId: string };
		parsedInput: { item: string };
	}>().define(async ({ ctx, parsedInput, next }) => {
		order.push("post-mw");
		const result = await next({ ctx: { audit: `${ctx.userId}:${parsedInput.item}` } });
		order.push("post-mw-after");
		return result;
	});

	const action = ac
		.use(preMiddleware)
		.inputSchema(z.object({ item: z.string() }))
		.useValidated(postMiddleware)
		.action(async ({ ctx }) => {
			order.push("action");
			return { audit: ctx.audit };
		});

	const result = await action({ item: "widget" });
	expect(result).toStrictEqual({ data: { audit: "u1:widget" } });
	expect(order).toStrictEqual(["pre-mw", "post-mw", "action", "post-mw-after", "pre-mw-after"]);
});

test("pre-validation standalone middleware sees validation error in result", async () => {
	let capturedResult: unknown;

	const preMiddleware = createMiddleware().define(async ({ next }) => {
		const result = await next();
		capturedResult = result;
		return result;
	});

	const postMiddleware = createValidatedMiddleware().define(async ({ next }) => {
		return next();
	});

	const action = ac
		.use(preMiddleware)
		.inputSchema(z.object({ name: z.string().min(5) }))
		.useValidated(postMiddleware)
		.action(async () => {
			return { ok: true };
		});

	await action({ name: "ab" });
	expect(capturedResult).toMatchObject({
		success: false,
		validationErrors: {
			name: { _errors: [expect.stringContaining("Too small")] },
		},
	});
});

// ─── stateAction compatibility ──────────────────────────────────────

test("createValidatedMiddleware works with stateAction", async () => {
	const mw = createValidatedMiddleware<{
		parsedInput: { name: string };
	}>().define(async ({ parsedInput, next }) => {
		return next({ ctx: { greeting: `hi ${parsedInput.name}` } });
	});

	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(mw)
		.stateAction(async ({ ctx }) => {
			return { greeting: ctx.greeting };
		});

	const result = await action({}, { name: "world" });
	expect(result).toStrictEqual({ data: { greeting: "hi world" } });
});

test("createMiddleware works with stateAction", async () => {
	const mw = createMiddleware().define(async ({ next }) => {
		return next({ ctx: { extra: "data" } });
	});

	const action = ac.use(mw).stateAction(async ({ ctx }) => {
		return { extra: ctx.extra };
	});

	const result = await action({});
	expect(result).toStrictEqual({ data: { extra: "data" } });
});
