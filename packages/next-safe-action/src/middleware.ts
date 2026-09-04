import type { MiddlewareFn, ValidatedMiddlewareFn } from "./index.types";
import type { StandardSchemaV1 } from "./standard-schema";

export type ActionDefinition = Readonly<{
	action: (...args: any[]) => Promise<any>;
	stateful: boolean;
	metadata: unknown;
	inputSchema: StandardSchemaV1 | undefined;
	outputSchema: StandardSchemaV1 | undefined;
	dynamicInputSchema: boolean;
	bindArgsCount: number;
}>;

export type MiddlewareOptions = {
	onActionDefined?: (definition: ActionDefinition) => void;
};

const definitionCallback = /* @__PURE__ */ Symbol.for("next-safe-action.onActionDefined.v1");

export function notifyActionDefined(middleware: Function, definition: ActionDefinition) {
	const callback = (middleware as unknown as Record<symbol, MiddlewareOptions["onActionDefined"]>)[definitionCallback];
	const result: unknown = callback?.(definition);
	if (result && typeof (result as PromiseLike<unknown>).then === "function") {
		void Promise.resolve(result).catch(() => {});
		throw new TypeError("onActionDefined must be synchronous");
	}
}

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
			>,
			options?: MiddlewareOptions
		) => {
			if (options?.onActionDefined?.constructor.name === "AsyncFunction") {
				throw new TypeError("onActionDefined must be synchronous");
			}
			// Wrap only decorated middleware so reusing a function does not change another client.
			if (!options?.onActionDefined) return middlewareFn;
			const decorated: typeof middlewareFn = (args) => middlewareFn(args);
			Object.defineProperty(decorated, definitionCallback, { value: options.onActionDefined });
			return decorated;
		},
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
