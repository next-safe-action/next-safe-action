import type { MiddlewareFn } from "./index.types";

/**
 * Creates a standalone middleware function. It accepts a generic object with optional `serverError`, `ctx` and `metadata`
 * properties, if you need one or all of them to be typed. The type for each property that is passed as generic is the
 * **minimum** shape required to define the middleware function, but it can also be larger than that.
 *
 * {@link https://next-safe-action.dev/docs/define-actions/middleware#create-standalone-middleware See docs for more information}
 */
export const createMiddleware = <BaseData extends { serverError?: any; ctx?: object; metadata?: any }>() => {
	return {
		define: <NextCtx extends object>(
			middlewareFn: MiddlewareFn<
				BaseData extends { serverError: infer SE } ? SE : any,
				BaseData extends { metadata: infer Metadata } ? Metadata : any,
				BaseData extends { ctx: infer Ctx extends object } ? Ctx : object,
				NextCtx
			>
		) => middlewareFn,
	};
};
