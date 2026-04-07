import type { Auth, BetterAuthOptions } from "better-auth";
import type { MiddlewareResult } from "next-safe-action";

/**
 * Narrow typed accessor for `auth.api.getSession`.
 *
 * Workaround: better-auth 1.6.0's `Auth<O>["api"]` resolves via
 * `InferAPI<ReturnType<typeof router<O>>["endpoints"]>`, which uses an
 * `Omit<BaseEndpoints, keyof PluginEndpoints<O>>`. When `O` is a generic
 * parameter TypeScript cannot determine which keys survive the `Omit`, so
 * `getSession` disappears from the type. Casting `auth.api` to this narrow
 * type restores access while keeping argument and return types safe via
 * `Auth<O>["$Infer"]["Session"]`.
 */
export type BetterAuthSessionApi<O extends BetterAuthOptions> = {
	getSession: (ctx: {
		headers: Headers;
		query?: {
			disableCookieCache?: boolean;
			disableRefresh?: boolean;
		};
	}) => Promise<Auth<O>["$Infer"]["Session"] | null>;
};

/**
 * The default context shape added by `betterAuth`.
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
	authData: Auth<O>["$Infer"]["Session"] | null;
	ctx: Ctx;
	next: <C extends object>(opts?: { ctx?: C }) => Promise<MiddlewareResult<any, C>>;
}) => Promise<MiddlewareResult<any, NC>>;

/**
 * Options for `betterAuth`.
 */
export type BetterAuthOpts<O extends BetterAuthOptions, NC extends object, Ctx extends object = object> = {
	authorize: AuthorizeFn<O, NC, Ctx>;
};
