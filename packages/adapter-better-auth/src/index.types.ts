import type { Auth, BetterAuthOptions } from "better-auth";
import type { MiddlewareResult } from "next-safe-action";

/**
 * The default context shape added by `betterAuthMiddleware`.
 * Contains `auth.user` and `auth.session`, fully typed from the better-auth instance.
 */
export type BetterAuthContext<O extends BetterAuthOptions> = {
	auth: Auth<O>["$Infer"]["Session"];
};

/**
 * Authorize callback signature for custom authorization logic.
 * Receives the pre-fetched session data, current context, and the `next` function.
 */
export type AuthorizeFn<O extends BetterAuthOptions, NC extends object, Ctx extends object = object> = (args: {
	sessionData: Auth<O>["$Infer"]["Session"] | null;
	ctx: Ctx;
	next: <C extends object>(opts?: { ctx?: C }) => Promise<MiddlewareResult<any, C>>;
}) => Promise<MiddlewareResult<any, NC>>;

/**
 * Options for `betterAuthMiddleware`.
 */
export type BetterAuthMiddlewareOpts<O extends BetterAuthOptions, NC extends object, Ctx extends object = object> = {
	authorize: AuthorizeFn<O, NC, Ctx>;
};
