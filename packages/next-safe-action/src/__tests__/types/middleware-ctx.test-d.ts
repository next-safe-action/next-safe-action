import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import type { InferMiddlewareFnNextCtx, MiddlewareFn, MiddlewareResult } from "../..";
import { createSafeActionClient, createMiddleware } from "../..";

test("single middleware adds context properties", () => {
	const ac = createSafeActionClient();

	ac.use(async ({ next }) => {
		return next({ ctx: { userId: "123" } });
	}).action(async ({ ctx }) => {
		expectTypeOf(ctx).toEqualTypeOf<{ userId: string }>();
		expectTypeOf(ctx).not.toBeAny();
		return {};
	});
});

test("multiple middleware accumulates context", () => {
	const ac = createSafeActionClient();

	ac.use(async ({ next }) => {
		return next({ ctx: { userId: "123" } });
	})
		.use(async ({ next }) => {
			return next({ ctx: { role: "admin" as const } });
		})
		.action(async ({ ctx }) => {
			// Prettify flattens intersection to a single object type
			expectTypeOf(ctx).toEqualTypeOf<{ userId: string; role: "admin" }>();
			expectTypeOf(ctx).not.toBeAny();
			return {};
		});
});

test("three middleware chains accumulate all context", () => {
	const ac = createSafeActionClient();

	ac.use(async ({ next }) => {
		return next({ ctx: { a: 1 } });
	})
		.use(async ({ next }) => {
			return next({ ctx: { b: "two" } });
		})
		.use(async ({ next }) => {
			return next({ ctx: { c: true } });
		})
		.action(async ({ ctx }) => {
			expectTypeOf(ctx).toEqualTypeOf<{ a: number; b: string; c: boolean }>();
			return {};
		});
});

test("middleware receives previous context", () => {
	const ac = createSafeActionClient();

	ac.use(async ({ next }) => {
		return next({ ctx: { userId: "123" } });
	}).use(async ({ ctx, next }) => {
		expectTypeOf(ctx).toEqualTypeOf<{ userId: string }>();
		return next({ ctx: { role: "admin" } });
	});
});

test("metadata is typed in middleware when metadata schema is defined", () => {
	const ac = createSafeActionClient({
		defineMetadataSchema: () => z.object({ actionName: z.string() }),
	});

	ac.use(async ({ metadata, next }) => {
		expectTypeOf(metadata).toEqualTypeOf<{ actionName: string }>();
		expectTypeOf(metadata).not.toBeAny();
		return next();
	});
});

test("metadata is undefined in middleware when no metadata schema", () => {
	const ac = createSafeActionClient();

	ac.use(async ({ metadata, next }) => {
		expectTypeOf(metadata).toEqualTypeOf<undefined>();
		return next();
	});
});

test("standalone middleware via createMiddleware constrains ctx", () => {
	const mw = createMiddleware<{ ctx: { userId: string } }>().define(async ({ ctx, next }) => {
		expectTypeOf(ctx).toEqualTypeOf<{ userId: string }>();
		return next({ ctx: { role: "admin" } });
	});

	expectTypeOf(mw).not.toBeAny();
});

test("standalone middleware with metadata constraint", () => {
	createMiddleware<{ metadata: { actionName: string } }>().define(async ({ metadata, next }) => {
		expectTypeOf(metadata).toEqualTypeOf<{ actionName: string }>();
		return next();
	});
});

// ─── Context override type narrowing ─────────────────────────────────

test("context key override narrows the type", () => {
	const ac = createSafeActionClient();

	ac.use(async ({ next }) => {
		return next({ ctx: { status: "pending" as string } });
	})
		.use(async ({ next }) => {
			// Override with a narrower type.
			return next({ ctx: { status: "active" as const } });
		})
		.action(async ({ ctx }) => {
			// After deep merge, the narrower type wins.
			expectTypeOf(ctx).toEqualTypeOf<{ status: "active" }>();
			return {};
		});
});

// ─── Standalone middleware with incompatible ctx ─────────────────────

test("standalone middleware with incompatible ctx constraint errors at use site", () => {
	const mwRequiresDb = createMiddleware<{ ctx: { db: { query: Function } } }>().define(async ({ next }) => {
		return next();
	});

	const ac = createSafeActionClient();

	// Using middleware that requires { db } on a client that doesn't provide it.
	// @ts-expect-error - ctx constraint mismatch
	ac.use(mwRequiresDb);
});

// ─── Middleware result type ──────────────────────────────────────────

test("await next() returns correctly typed MiddlewareResult", () => {
	const ac = createSafeActionClient();

	ac.use(async ({ next }) => {
		const result = await next({ ctx: { added: true } });
		expectTypeOf(result).toEqualTypeOf<MiddlewareResult<string, { added: true }>>();
		expectTypeOf(result.success).toEqualTypeOf<boolean>();
		expectTypeOf(result.ctx).toEqualTypeOf<object | undefined>();
		return result;
	});
});

// ─── InferMiddlewareFnNextCtx ────────────────────────────────────────

test("InferMiddlewareFnNextCtx extracts next context from middleware", () => {
	const mw = createMiddleware().define(async ({ next }) => {
		return next({ ctx: { userId: "123", role: "admin" as const } });
	});

	type NextCtx = InferMiddlewareFnNextCtx<typeof mw>;
	expectTypeOf<NextCtx>().toEqualTypeOf<{ userId: string; role: "admin" }>();
});

test("InferMiddlewareFnNextCtx returns never for non-middleware", () => {
	type Result = InferMiddlewareFnNextCtx<string>;
	expectTypeOf<Result>().toEqualTypeOf<never>();
});

// ─── MiddlewareFn type ───────────────────────────────────────────────

test("MiddlewareFn type parameters are correctly constrained", () => {
	type TestMw = MiddlewareFn<string, { actionName: string }, { userId: string }, { role: string }>;

	// A function matching this type should have correct parameter types.
	const mw: TestMw = async ({ ctx, metadata, next }) => {
		expectTypeOf(ctx).toEqualTypeOf<{ userId: string }>();
		expectTypeOf(metadata).toEqualTypeOf<{ actionName: string }>();
		return next({ ctx: { role: "admin" } });
	};

	expectTypeOf(mw).not.toBeAny();
});
