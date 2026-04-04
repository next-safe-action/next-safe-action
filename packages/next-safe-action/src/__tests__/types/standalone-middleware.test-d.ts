import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import type {
	InferCtx,
	InferMetadata,
	InferMiddlewareFnNextCtx,
	InferServerError,
	InferValidatedMiddlewareFnNextCtx,
	MiddlewareResult,
} from "../..";
import { createMiddleware, createSafeActionClient, createValidatedMiddleware } from "../..";

// ═══════════════════════════════════════════════════════════════════════
// createMiddleware() type tests
// ═══════════════════════════════════════════════════════════════════════

// ─── Constraint inference ───────────────────────────────────────────

test("createMiddleware with no constraints: ctx is object, metadata is any", () => {
	createMiddleware().define(async ({ ctx, metadata, next }) => {
		expectTypeOf(ctx).toEqualTypeOf<object>();
		expectTypeOf(metadata).toBeAny();
		return next();
	});
});

test("createMiddleware with ctx constraint infers ctx type", () => {
	createMiddleware<{ ctx: { userId: string; role: "admin" | "user" } }>().define(async ({ ctx, next }) => {
		expectTypeOf(ctx).toEqualTypeOf<{ userId: string; role: "admin" | "user" }>();
		return next();
	});
});

test("createMiddleware with metadata constraint infers metadata type", () => {
	createMiddleware<{ metadata: { actionName: string; version: number } }>().define(async ({ metadata, next }) => {
		expectTypeOf(metadata).toEqualTypeOf<{ actionName: string; version: number }>();
		return next();
	});
});

test("createMiddleware with serverError constraint infers serverError type", () => {
	const mw = createMiddleware<{ serverError: { code: string; message: string } }>().define(async ({ next }) => {
		const result = await next();
		expectTypeOf(result).toEqualTypeOf<MiddlewareResult<{ code: string; message: string }, {}>>();
		return result;
	});
	expectTypeOf(mw).not.toBeAny();
});

test("createMiddleware with all constraints infers all types", () => {
	createMiddleware<{
		serverError: string;
		ctx: { db: object };
		metadata: { name: string };
	}>().define(async ({ ctx, metadata, next }) => {
		expectTypeOf(ctx).toEqualTypeOf<{ db: object }>();
		expectTypeOf(metadata).toEqualTypeOf<{ name: string }>();
		const result = await next();
		expectTypeOf(result).toEqualTypeOf<MiddlewareResult<string, {}>>();
		return result;
	});
});

// ─── NextCtx inference from next() call ─────────────────────────────

test("createMiddleware infers NextCtx from next() call", () => {
	const mw = createMiddleware().define(async ({ next }) => {
		return next({ ctx: { userId: "123", active: true } });
	});

	type NextCtx = InferMiddlewareFnNextCtx<typeof mw>;
	expectTypeOf<NextCtx>().toEqualTypeOf<{ userId: string; active: boolean }>();
});

test("createMiddleware with no ctx passed to next() infers empty NextCtx", () => {
	const mw = createMiddleware().define(async ({ next }) => {
		return next();
	});

	type NextCtx = InferMiddlewareFnNextCtx<typeof mw>;
	expectTypeOf<NextCtx>().toEqualTypeOf<{}>();
});

// ─── Composition with SafeActionClient ──────────────────────────────

test("standalone middleware composes with client and accumulates context", () => {
	const mw = createMiddleware<{ ctx: { userId: string } }>().define(async ({ next }) => {
		return next({ ctx: { role: "admin" as const } });
	});

	const ac = createSafeActionClient();
	ac.use(async ({ next }) => next({ ctx: { userId: "123" } }))
		.use(mw)
		.action(async ({ ctx }) => {
			expectTypeOf(ctx).toEqualTypeOf<{ userId: string; role: "admin" }>();
			return {};
		});
});

test("standalone middleware with incompatible ctx fails at use() site", () => {
	const mw = createMiddleware<{ ctx: { db: object } }>().define(async ({ next }) => {
		return next();
	});

	const ac = createSafeActionClient();
	// @ts-expect-error - client has no db in context
	ac.use(mw);
});

test("standalone middleware with incompatible metadata fails at use() site", () => {
	const mw = createMiddleware<{ metadata: { actionName: string } }>().define(async ({ next }) => {
		return next();
	});

	const ac = createSafeActionClient();
	// Client has no metadata schema (metadata = undefined), but middleware expects { actionName: string }
	// @ts-expect-error - metadata type mismatch
	ac.use(mw);
});

test("multiple standalone middleware compose and accumulate context types", () => {
	const mw1 = createMiddleware().define(async ({ next }) => {
		return next({ ctx: { a: 1 } });
	});

	const mw2 = createMiddleware().define(async ({ next }) => {
		return next({ ctx: { b: "two" } });
	});

	const ac = createSafeActionClient();
	ac.use(mw1)
		.use(mw2)
		.action(async ({ ctx }) => {
			expectTypeOf(ctx).toEqualTypeOf<{ a: number; b: string }>();
			return {};
		});
});

// ─── InferCtx / InferMetadata / InferServerError ────────────────────

test("InferCtx extracts ctx from createMiddleware", () => {
	const mw = createMiddleware<{ ctx: { userId: string; role: string } }>().define(async ({ next }) => next());
	type Ctx = InferCtx<typeof mw>;
	expectTypeOf<Ctx>().toEqualTypeOf<{ userId: string; role: string }>();
});

test("InferMetadata extracts metadata from createMiddleware", () => {
	const mw = createMiddleware<{ metadata: { name: string } }>().define(async ({ next }) => next());
	type Meta = InferMetadata<typeof mw>;
	expectTypeOf<Meta>().toEqualTypeOf<{ name: string }>();
});

test("InferServerError extracts serverError from createMiddleware", () => {
	const mw = createMiddleware<{ serverError: { code: number } }>().define(async ({ next }) => next());
	type SE = InferServerError<typeof mw>;
	expectTypeOf<SE>().toEqualTypeOf<{ code: number }>();
});

test("InferCtx returns object when no ctx constraint is specified", () => {
	const mw = createMiddleware().define(async ({ next }) => next());
	type Ctx = InferCtx<typeof mw>;
	expectTypeOf<Ctx>().toEqualTypeOf<object>();
});

// ═══════════════════════════════════════════════════════════════════════
// createValidatedMiddleware() type tests
// ═══════════════════════════════════════════════════════════════════════

// ─── Constraint inference ───────────────────────────────────────────

test("createValidatedMiddleware with no constraints: all types are permissive defaults", () => {
	createValidatedMiddleware().define(async ({ parsedInput, clientInput, bindArgsParsedInputs, bindArgsClientInputs, ctx, metadata, next }) => {
		expectTypeOf(parsedInput).toBeUnknown();
		expectTypeOf(clientInput).toBeUnknown();
		expectTypeOf(bindArgsParsedInputs).toEqualTypeOf<readonly unknown[]>();
		expectTypeOf(bindArgsClientInputs).toEqualTypeOf<readonly unknown[]>();
		expectTypeOf(ctx).toEqualTypeOf<object>();
		expectTypeOf(metadata).toBeAny();
		return next();
	});
});

test("createValidatedMiddleware with parsedInput constraint infers parsedInput type", () => {
	createValidatedMiddleware<{
		parsedInput: { name: string; age: number };
	}>().define(async ({ parsedInput, next }) => {
		expectTypeOf(parsedInput).toEqualTypeOf<{ name: string; age: number }>();
		return next();
	});
});

test("createValidatedMiddleware with clientInput constraint infers clientInput type", () => {
	createValidatedMiddleware<{
		clientInput: { name: string };
	}>().define(async ({ clientInput, next }) => {
		expectTypeOf(clientInput).toEqualTypeOf<{ name: string }>();
		return next();
	});
});

test("createValidatedMiddleware with bindArgsParsedInputs constraint infers tuple type", () => {
	createValidatedMiddleware<{
		bindArgsParsedInputs: readonly [number, string];
	}>().define(async ({ bindArgsParsedInputs, next }) => {
		expectTypeOf(bindArgsParsedInputs).toEqualTypeOf<readonly [number, string]>();
		return next();
	});
});

test("createValidatedMiddleware with bindArgsClientInputs constraint infers tuple type", () => {
	createValidatedMiddleware<{
		bindArgsClientInputs: readonly [number, string];
	}>().define(async ({ bindArgsClientInputs, next }) => {
		expectTypeOf(bindArgsClientInputs).toEqualTypeOf<readonly [number, string]>();
		return next();
	});
});

test("createValidatedMiddleware with ctx and parsedInput constraints", () => {
	createValidatedMiddleware<{
		ctx: { user: { id: string } };
		parsedInput: { resourceId: string };
	}>().define(async ({ ctx, parsedInput, next }) => {
		expectTypeOf(ctx).toEqualTypeOf<{ user: { id: string } }>();
		expectTypeOf(parsedInput).toEqualTypeOf<{ resourceId: string }>();
		return next();
	});
});

test("createValidatedMiddleware with all constraints infers all types", () => {
	createValidatedMiddleware<{
		serverError: { code: string };
		ctx: { db: object };
		metadata: { name: string };
		parsedInput: { value: number };
		clientInput: { value: string };
		bindArgsParsedInputs: readonly [boolean];
		bindArgsClientInputs: readonly [string];
	}>().define(async ({ ctx, metadata, parsedInput, clientInput, bindArgsParsedInputs, bindArgsClientInputs, next }) => {
		expectTypeOf(ctx).toEqualTypeOf<{ db: object }>();
		expectTypeOf(metadata).toEqualTypeOf<{ name: string }>();
		expectTypeOf(parsedInput).toEqualTypeOf<{ value: number }>();
		expectTypeOf(clientInput).toEqualTypeOf<{ value: string }>();
		expectTypeOf(bindArgsParsedInputs).toEqualTypeOf<readonly [boolean]>();
		expectTypeOf(bindArgsClientInputs).toEqualTypeOf<readonly [string]>();
		const result = await next();
		expectTypeOf(result).toEqualTypeOf<MiddlewareResult<{ code: string }, {}>>();
		return result;
	});
});

// ─── NextCtx inference from next() call ─────────────────────────────

test("createValidatedMiddleware infers NextCtx from next() call", () => {
	const mw = createValidatedMiddleware().define(async ({ next }) => {
		return next({ ctx: { authorized: true, role: "admin" as const } });
	});

	type NextCtx = InferValidatedMiddlewareFnNextCtx<typeof mw>;
	expectTypeOf<NextCtx>().toEqualTypeOf<{ authorized: boolean; role: "admin" }>();
});

test("createValidatedMiddleware with no ctx passed to next() infers empty NextCtx", () => {
	const mw = createValidatedMiddleware().define(async ({ next }) => {
		return next();
	});

	type NextCtx = InferValidatedMiddlewareFnNextCtx<typeof mw>;
	expectTypeOf<NextCtx>().toEqualTypeOf<{}>();
});

// ─── Composition with SafeActionClient ──────────────────────────────

test("standalone validated middleware composes with useValidated and accumulates context", () => {
	const mw = createValidatedMiddleware<{
		parsedInput: { name: string };
	}>().define(async ({ parsedInput, next }) => {
		return next({ ctx: { greeting: parsedInput.name } });
	});

	const ac = createSafeActionClient();
	ac.use(async ({ next }) => next({ ctx: { userId: "123" } }))
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(mw)
		.action(async ({ ctx }) => {
			expectTypeOf(ctx).toEqualTypeOf<{ userId: string; greeting: string }>();
			return {};
		});
});

test("standalone validated middleware with incompatible parsedInput fails at useValidated() site", () => {
	const mw = createValidatedMiddleware<{
		parsedInput: { name: string; age: number };
	}>().define(async ({ next }) => next());

	const ac = createSafeActionClient();
	ac.inputSchema(z.object({ name: z.string() }))
		// @ts-expect-error - parsedInput mismatch: missing 'age' property
		.useValidated(mw)
		.action(async () => ({}));
});

test("standalone validated middleware with incompatible ctx fails at useValidated() site", () => {
	const mw = createValidatedMiddleware<{
		ctx: { db: object };
		parsedInput: string;
	}>().define(async ({ next }) => next());

	const ac = createSafeActionClient();
	ac.inputSchema(z.string())
		// @ts-expect-error - ctx mismatch: client has no db in context
		.useValidated(mw)
		.action(async () => ({}));
});

test("standalone validated middleware with incompatible bindArgsParsedInputs fails at useValidated() site", () => {
	const mw = createValidatedMiddleware<{
		parsedInput: string;
		bindArgsParsedInputs: readonly [number, boolean];
	}>().define(async ({ next }) => next());

	const ac = createSafeActionClient();
	ac.inputSchema(z.string())
		.bindArgsSchemas([z.number()])
		// @ts-expect-error - bindArgsParsedInputs mismatch: expects [number, boolean] but only [number]
		.useValidated(mw)
		.action(async () => ({}));
});

test("multiple standalone validated middleware compose and accumulate context types", () => {
	const mw1 = createValidatedMiddleware().define(async ({ next }) => {
		return next({ ctx: { first: true } });
	});

	const mw2 = createValidatedMiddleware().define(async ({ next }) => {
		return next({ ctx: { second: "two" } });
	});

	const ac = createSafeActionClient();
	ac.inputSchema(z.string())
		.useValidated(mw1)
		.useValidated(mw2)
		.action(async ({ ctx }) => {
			expectTypeOf(ctx).toEqualTypeOf<{ first: boolean; second: string }>();
			return {};
		});
});

// ─── InferCtx / InferMetadata / InferServerError ────────────────────

test("InferCtx extracts ctx from createValidatedMiddleware", () => {
	const mw = createValidatedMiddleware<{
		ctx: { userId: string };
		parsedInput: string;
	}>().define(async ({ next }) => next());

	type Ctx = InferCtx<typeof mw>;
	expectTypeOf<Ctx>().toEqualTypeOf<{ userId: string }>();
});

test("InferMetadata extracts metadata from createValidatedMiddleware", () => {
	const mw = createValidatedMiddleware<{
		metadata: { actionName: string };
		parsedInput: string;
	}>().define(async ({ next }) => next());

	type Meta = InferMetadata<typeof mw>;
	expectTypeOf<Meta>().toEqualTypeOf<{ actionName: string }>();
});

test("InferServerError extracts serverError from createValidatedMiddleware", () => {
	const mw = createValidatedMiddleware<{
		serverError: { code: number };
		parsedInput: string;
	}>().define(async ({ next }) => next());

	type SE = InferServerError<typeof mw>;
	expectTypeOf<SE>().toEqualTypeOf<{ code: number }>();
});

// ─── Mixed standalone use() + useValidated() ────────────────────────

test("standalone createMiddleware + standalone createValidatedMiddleware compose types", () => {
	const preMw = createMiddleware().define(async ({ next }) => {
		return next({ ctx: { userId: "123" } });
	});

	const postMw = createValidatedMiddleware<{
		ctx: { userId: string };
		parsedInput: { name: string };
	}>().define(async ({ ctx, parsedInput, next }) => {
		return next({ ctx: { greeting: `hi ${parsedInput.name} (${ctx.userId})` } });
	});

	const ac = createSafeActionClient();
	ac.use(preMw)
		.inputSchema(z.object({ name: z.string() }))
		.useValidated(postMw)
		.action(async ({ ctx }) => {
			expectTypeOf(ctx).toEqualTypeOf<{ userId: string; greeting: string }>();
			return {};
		});
});

// ─── Error callback ctx typing with standalone middleware ────────────

test("error callback ctx has pre-validation fields required and validated fields optional with standalone middleware", () => {
	const preMw = createMiddleware().define(async ({ next }) => {
		return next({ ctx: { guaranteed: "yes" } });
	});

	const postMw = createValidatedMiddleware().define(async ({ next }) => {
		return next({ ctx: { maybePresent: 42 } });
	});

	const ac = createSafeActionClient();
	ac.use(preMw)
		.inputSchema(z.string())
		.useValidated(postMw)
		.action(
			async ({ ctx }) => {
				expectTypeOf(ctx).toEqualTypeOf<{ guaranteed: string; maybePresent: number }>();
				return {};
			},
			{
				onError: ({ ctx }) => {
					expectTypeOf(ctx).toEqualTypeOf<
						{ guaranteed: string; maybePresent?: number | undefined } | undefined
					>();
					return Promise.resolve();
				},
				onSettled: ({ ctx }) => {
					expectTypeOf(ctx).toEqualTypeOf<
						{ guaranteed: string; maybePresent?: number | undefined } | undefined
					>();
					return Promise.resolve();
				},
			}
		);
});
