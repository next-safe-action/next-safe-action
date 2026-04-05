import type { Auth, BetterAuthOptions } from "better-auth";
import { createMiddleware } from "next-safe-action";
import type { MiddlewareFn } from "next-safe-action";
import { headers } from "next/headers";
import { unauthorized } from "next/navigation";
import type { BetterAuthContext, BetterAuthOpts } from "./index.types";

/**
 * Creates a next-safe-action middleware that integrates with better-auth.
 *
 * Default behavior: fetches the session via `auth.api.getSession()`, calls `unauthorized()` if
 * no session exists, and injects `{ auth: { user, session } }` into the action context.
 *
 * Pass an `authorize` callback to customize the authorization flow. The session is pre-fetched
 * and passed to the callback, so common customizations (e.g. role checks) don't need to re-fetch.
 *
 * Note: `unauthorized()` requires `experimental.authInterrupts: true` in your `next.config.ts` file.
 *
 * @example
 * ```ts
 * // Default: fetch session, unauthorized() if absent
 * actionClient.use(betterAuth(auth));
 *
 * // Custom: check role
 * actionClient.use(betterAuth(auth, {
 *   authorize: ({ sessionData, next }) => {
 *     if (!sessionData || sessionData.user.role !== "admin") {
 *       unauthorized();
 *     }
 *     return next({ ctx: { auth: sessionData } });
 *   },
 * }));
 * ```
 */
export function betterAuth<O extends BetterAuthOptions>(
	auth: Auth<O>
): MiddlewareFn<any, any, object, BetterAuthContext<O>>;
export function betterAuth<O extends BetterAuthOptions, NC extends object, Ctx extends object>(
	auth: Auth<O>,
	opts: BetterAuthOpts<O, NC, Ctx>
): MiddlewareFn<any, any, Ctx, NC>;
export function betterAuth<O extends BetterAuthOptions>(
	auth: Auth<O>,
	opts?: BetterAuthOpts<O, any, any>
) {
	return createMiddleware().define(async ({ ctx, next }) => {
		const sessionData = await auth.api.getSession({ headers: await headers() });

		if (opts?.authorize) {
			return opts.authorize({ sessionData, ctx, next });
		}

		if (!sessionData) {
			unauthorized();
		}

		return next({ ctx: { auth: { user: sessionData.user, session: sessionData.session } } });
	});
}

export type { AuthorizeFn, BetterAuthContext, BetterAuthOpts } from "./index.types";
