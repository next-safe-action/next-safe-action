import type { Auth, BetterAuthOptions } from "better-auth";
import { headers } from "next/headers";
import { unauthorized } from "next/navigation";
import type { MiddlewareFn } from "next-safe-action";
import type { BetterAuthContext, BetterAuthMiddlewareOpts } from "./index.types";

/**
 * Creates a next-safe-action middleware that integrates with better-auth.
 *
 * Default behavior: fetches the session via `auth.api.getSession()`, calls `unauthorized()` if
 * no session exists, and injects `{ auth: { user, session } }` into the action context.
 *
 * Pass an `authorize` callback to customize the authorization flow. The session is pre-fetched
 * and passed to the callback, so common customizations (e.g. role checks) don't need to re-fetch.
 *
 * Note: `unauthorized()` requires `experimental.authInterrupts: true` in your `next.config` file.
 *
 * @example
 * ```ts
 * // Default: fetch session, unauthorized() if absent
 * actionClient.use(betterAuthMiddleware(auth));
 *
 * // Custom: check role
 * actionClient.use(betterAuthMiddleware(auth, {
 *   authorize: ({ sessionData, next }) => {
 *     if (!sessionData || sessionData.user.role !== "admin") {
 *       unauthorized();
 *     }
 *     return next({ ctx: { auth: sessionData } });
 *   },
 * }));
 * ```
 */
export function betterAuthMiddleware<O extends BetterAuthOptions>(
	auth: Auth<O>
): MiddlewareFn<any, any, object, BetterAuthContext<O>>;
export function betterAuthMiddleware<O extends BetterAuthOptions, NC extends object>(
	auth: Auth<O>,
	opts: BetterAuthMiddlewareOpts<O, NC>
): MiddlewareFn<any, any, object, NC>;
export function betterAuthMiddleware<O extends BetterAuthOptions>(
	auth: Auth<O>,
	opts?: BetterAuthMiddlewareOpts<O, any>
) {
	return async ({ ctx, next }: any) => {
		const sessionData = await auth.api.getSession({ headers: await headers() });

		if (opts?.authorize) {
			return opts.authorize({ auth, sessionData, ctx, next });
		}

		if (!sessionData) {
			unauthorized();
		}

		return next({ ctx: { auth: { user: sessionData.user, session: sessionData.session } } });
	};
}

export type { AuthorizeFn, BetterAuthContext, BetterAuthMiddlewareOpts } from "./index.types";
