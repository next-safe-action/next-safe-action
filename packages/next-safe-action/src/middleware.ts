import type { MiddlewareFn, ValidatedMiddlewareFn } from "./index.types";

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

/**
 * Creates a standalone validated middleware function. It accepts a generic object with optional `serverError`, `ctx`,
 * `metadata`, `parsedInput`, `clientInput`, `bindArgsParsedInputs`, and `bindArgsClientInputs` properties, if you need
 * one or all of them to be typed. The type for each property that is passed as generic is the **minimum** shape required
 * to define the validated middleware function, but it can also be larger than that.
 *
 * Validated middleware runs after input validation and receives typed parsed inputs.
 *
 * {@link https://next-safe-action.dev/docs/define-actions/middleware#create-standalone-validated-middleware See docs for more information}
 */
export const createValidatedMiddleware = <
	BaseData extends {
		serverError?: any;
		ctx?: object;
		metadata?: any;
		parsedInput?: unknown;
		clientInput?: unknown;
		bindArgsParsedInputs?: readonly unknown[];
		bindArgsClientInputs?: readonly unknown[];
	},
>() => {
	return {
		define: <NextCtx extends object>(
			middlewareFn: ValidatedMiddlewareFn<
				BaseData extends { serverError: infer SE } ? SE : any,
				BaseData extends { metadata: infer Metadata } ? Metadata : any,
				BaseData extends { ctx: infer Ctx extends object } ? Ctx : object,
				NextCtx,
				BaseData extends { parsedInput: infer PI } ? PI : unknown,
				BaseData extends { clientInput: infer CI } ? CI : unknown,
				BaseData extends { bindArgsParsedInputs: infer BAPI extends readonly unknown[] } ? BAPI : readonly unknown[],
				BaseData extends { bindArgsClientInputs: infer BACI extends readonly unknown[] } ? BACI : readonly unknown[]
			>
		) => middlewareFn,
	};
};
