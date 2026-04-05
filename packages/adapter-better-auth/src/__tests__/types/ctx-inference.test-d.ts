import type { Auth } from "better-auth";
import { createMiddleware, createSafeActionClient } from "next-safe-action";
import { test, expectTypeOf } from "vitest";
import { betterAuth } from "../..";

declare const auth: Auth;

// ─── Context inference with prior middleware ─────────────────────────

test("authorize callback ctx inherits prior middleware context when used inline", () => {
	const client = createSafeActionClient().use(async ({ next }) => {
		return next({ ctx: { userId: "user-1" } });
	});

	client.use(
		betterAuth(auth, {
			authorize: ({ ctx, authData, next }) => {
				expectTypeOf(ctx).toEqualTypeOf<{ userId: string }>();
				if (!authData) {
					throw new Error("Unauthorized");
				}
				return next({ ctx: { auth: authData } });
			},
		})
	);
});

test("authorize callback ctx is empty object when no prior middleware exists", () => {
	const client = createSafeActionClient();

	client.use(
		betterAuth(auth, {
			authorize: ({ ctx, next }) => {
				expectTypeOf(ctx).toEqualTypeOf<{}>();
				return next();
			},
		})
	);
});

test("authorize callback ctx inherits multiple layers of prior middleware context", () => {
	const client = createSafeActionClient()
		.use(async ({ next }) => {
			return next({ ctx: { userId: "user-1" } });
		})
		.use(async ({ next }) => {
			return next({ ctx: { role: "admin" as const } });
		});

	client.use(
		betterAuth(auth, {
			authorize: ({ ctx, next }) => {
				expectTypeOf(ctx).toEqualTypeOf<{ userId: string } & { role: "admin" }>();
				return next();
			},
		})
	);
});

test("authorize callback ctx inherits context from standalone createMiddleware", () => {
	const loggerMiddleware = createMiddleware().define(async ({ next }) => {
		return next({ ctx: { logger: { info: (_msg: string) => {} } } });
	});

	const client = createSafeActionClient().use(loggerMiddleware);

	client.use(
		betterAuth(auth, {
			authorize: ({ ctx, next }) => {
				expectTypeOf(ctx).toEqualTypeOf<{ logger: { info: (msg: string) => void } }>();
				return next();
			},
		})
	);
});

// ─── Default flow context output ────────────────────────────────────

test("default betterAuth adds BetterAuthContext to the client", () => {
	const client = createSafeActionClient()
		.use(async ({ next }) => {
			return next({ ctx: { userId: "user-1" } });
		})
		.use(betterAuth(auth));

	// After default betterAuth, next .use() receives merged context with both prior and auth context
	client.use(async ({ ctx, next }) => {
		expectTypeOf(ctx).toHaveProperty("userId");
		expectTypeOf(ctx).toHaveProperty("auth");
		expectTypeOf(ctx.userId).toBeString();
		return next();
	});
});
