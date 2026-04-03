import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import type {
	InferCtx,
	InferMetadata,
	InferServerError,
	InferValidatedMiddlewareFnNextCtx,
	ValidatedMiddlewareFn,
} from "../..";
import { createSafeActionClient, createValidatedMiddleware } from "../..";

test("useValidated compiles after inputSchema", () => {
	const ac = createSafeActionClient();
	// This should compile without error
	ac.inputSchema(z.object({ name: z.string() }))
		.useValidated(async ({ parsedInput, next }) => {
			expectTypeOf(parsedInput).toEqualTypeOf<{ name: string }>();
			return next();
		})
		.action(async () => ({}));
});

test("useValidated compiles after bindArgsSchemas", () => {
	const ac = createSafeActionClient();
	ac.bindArgsSchemas([z.string(), z.number()])
		.useValidated(async ({ bindArgsParsedInputs, next }) => {
			expectTypeOf(bindArgsParsedInputs).toEqualTypeOf<readonly [string, number]>();
			return next();
		})
		.action(async () => ({}));
});

test("useValidated errors without any schema", () => {
	const ac = createSafeActionClient();
	// @ts-expect-error - no inputSchema or bindArgsSchemas before useValidated
	ac.useValidated(async ({ next }) => next());
});

test("inputSchema errors after useValidated", () => {
	const ac = createSafeActionClient();
	// @ts-expect-error - inputSchema cannot be called after useValidated
	ac.inputSchema(z.string()).useValidated(async ({ next }) => next()).inputSchema(z.number());
});

test("bindArgsSchemas errors after useValidated", () => {
	const ac = createSafeActionClient();
	// @ts-expect-error - bindArgsSchemas cannot be called after useValidated
	ac.inputSchema(z.string()).useValidated(async ({ next }) => next()).bindArgsSchemas([z.number()]);
});

test("use works after useValidated", () => {
	const ac = createSafeActionClient();
	// This should compile without error - use() is unrestricted
	ac.inputSchema(z.string())
		.useValidated(async ({ next }) => next())
		.use(async ({ next }) => next({ ctx: { extra: true } }))
		.action(async () => ({}));
});

test("parsedInput type matches InferOutput", () => {
	const ac = createSafeActionClient();
	ac.inputSchema(z.string().transform((s) => s.length))
		.useValidated(async ({ parsedInput, clientInput, next }) => {
			// parsedInput is the output type (after transform)
			expectTypeOf(parsedInput).toEqualTypeOf<number>();
			// clientInput is the input type (before transform)
			expectTypeOf(clientInput).toEqualTypeOf<string>();
			return next();
		})
		.action(async () => ({}));
});

test("bindArgsParsedInputs type matches tuple", () => {
	const ac = createSafeActionClient();
	ac.inputSchema(z.string())
		.bindArgsSchemas([z.number(), z.boolean()])
		.useValidated(async ({ bindArgsParsedInputs, bindArgsClientInputs, next }) => {
			expectTypeOf(bindArgsParsedInputs).toEqualTypeOf<readonly [number, boolean]>();
			expectTypeOf(bindArgsClientInputs).toEqualTypeOf<readonly [number, boolean]>();
			return next();
		})
		.action(async () => ({}));
});

test("context accumulation across use and useValidated", () => {
	const ac = createSafeActionClient();
	ac.use(async ({ next }) => next({ ctx: { a: 1 } }))
		.inputSchema(z.string())
		.useValidated(async ({ ctx, next }) => {
			expectTypeOf(ctx).toEqualTypeOf<{ a: number }>();
			return next({ ctx: { b: "two" } });
		})
		.action(async ({ ctx }) => {
			expectTypeOf(ctx).toEqualTypeOf<{ a: number; b: string }>();
			return {};
		});
});

test("createValidatedMiddleware type inference", () => {
	const mw = createValidatedMiddleware<{
		parsedInput: { name: string };
		ctx: { db: object };
	}>().define(async ({ parsedInput, ctx, next }) => {
		expectTypeOf(parsedInput).toEqualTypeOf<{ name: string }>();
		expectTypeOf(ctx).toEqualTypeOf<{ db: object }>();
		return next();
	});
	expectTypeOf(mw).not.toBeAny();
});

test("createValidatedMiddleware composable with useValidated", () => {
	const mw = createValidatedMiddleware<{
		parsedInput: { name: string };
	}>().define(async ({ parsedInput, next }) => {
		return next({ ctx: { greeting: parsedInput.name } });
	});

	const ac = createSafeActionClient();
	// The standalone middleware should be compatible with useValidated
	ac.inputSchema(z.object({ name: z.string() }))
		.useValidated(mw)
		.action(async ({ ctx }) => {
			expectTypeOf(ctx).toEqualTypeOf<{ greeting: string }>();
			return {};
		});
});

test("error callback ctx has pre-validation fields required and validated fields optional", () => {
	const ac = createSafeActionClient();
	ac.use(async ({ next }) => next({ ctx: { guaranteed: "yes" } }))
		.inputSchema(z.string())
		.useValidated(async ({ next }) => next({ ctx: { maybePresent: 42 } }))
		.action(
			async ({ ctx }) => {
				// In server code, full context is available
				expectTypeOf(ctx).toEqualTypeOf<{ guaranteed: string; maybePresent: number }>();
				return {};
			},
			{
				onSuccess: ({ ctx }) => {
					// onSuccess: full context is available (all middleware ran)
					expectTypeOf(ctx).toEqualTypeOf<{ guaranteed: string; maybePresent: number } | undefined>();
					return Promise.resolve();
				},
				onError: ({ ctx }) => {
					// onError: pre-validation fields guaranteed, validated fields optional
					expectTypeOf(ctx).toEqualTypeOf<
						{ guaranteed: string; maybePresent?: number | undefined } | undefined
					>();
					return Promise.resolve();
				},
				onSettled: ({ ctx }) => {
					// onSettled: same as onError
					expectTypeOf(ctx).toEqualTypeOf<
						{ guaranteed: string; maybePresent?: number | undefined } | undefined
					>();
					return Promise.resolve();
				},
			}
		);
});

test("error callback ctx is full when no useValidated is used", () => {
	const ac = createSafeActionClient();
	ac.use(async ({ next }) => next({ ctx: { foo: "bar" } }))
		.inputSchema(z.string())
		.action(
			async () => ({}),
			{
				onError: ({ ctx }) => {
					// When no useValidated is used, PreValidationCtx = Ctx, so no Partial
					expectTypeOf(ctx).toEqualTypeOf<{ foo: string } | undefined>();
					return Promise.resolve();
				},
			}
		);
});

test("useValidated with both inputSchema and bindArgsSchemas", () => {
	const ac = createSafeActionClient();
	ac.inputSchema(z.object({ name: z.string() }))
		.bindArgsSchemas([z.number()])
		.useValidated(async ({ parsedInput, bindArgsParsedInputs, next }) => {
			expectTypeOf(parsedInput).toEqualTypeOf<{ name: string }>();
			expectTypeOf(bindArgsParsedInputs).toEqualTypeOf<readonly [number]>();
			return next();
		})
		.action(async () => ({}));
});

// ─── Metadata typing in useValidated() ───────────────────────────────

test("metadata is typed in useValidated when metadata schema is defined", () => {
	const ac = createSafeActionClient({
		defineMetadataSchema: () => z.object({ actionName: z.string(), version: z.number() }),
	});

	ac.metadata({ actionName: "test", version: 1 })
		.inputSchema(z.string())
		.useValidated(async ({ metadata, next }) => {
			expectTypeOf(metadata).toEqualTypeOf<{ actionName: string; version: number }>();
			expectTypeOf(metadata).not.toBeAny();
			return next();
		})
		.action(async () => ({}));
});

test("metadata is undefined in useValidated when no metadata schema", () => {
	const ac = createSafeActionClient();

	ac.inputSchema(z.string())
		.useValidated(async ({ metadata, next }) => {
			expectTypeOf(metadata).toEqualTypeOf<undefined>();
			return next();
		})
		.action(async () => ({}));
});

// ─── stateAction + useValidated() types ──────────────────────────────

test("stateAction types flow correctly after useValidated", () => {
	const ac = createSafeActionClient();

	ac.inputSchema(z.object({ name: z.string() }))
		.useValidated(async ({ parsedInput, next }) => {
			expectTypeOf(parsedInput).toEqualTypeOf<{ name: string }>();
			return next({ ctx: { validated: true } });
		})
		.stateAction(async ({ parsedInput, ctx }) => {
			expectTypeOf(parsedInput).toEqualTypeOf<{ name: string }>();
			expectTypeOf(ctx).toEqualTypeOf<{ validated: boolean }>();
			return { result: parsedInput.name };
		});
});

test("stateAction with useValidated receives prevResult", () => {
	const ac = createSafeActionClient();

	ac.inputSchema(z.string())
		.useValidated(async ({ next }) => next())
		.stateAction(async ({ parsedInput }, { prevResult }) => {
			expectTypeOf(parsedInput).toEqualTypeOf<string>();
			// prevResult has serverError as string (default) and validationErrors shape.
			expectTypeOf(prevResult.serverError).not.toBeAny();
			return { value: parsedInput };
		});
});

// ─── InferValidatedMiddlewareFnNextCtx ───────────────────────────────

test("InferValidatedMiddlewareFnNextCtx extracts next context from validated middleware", () => {
	const mw = createValidatedMiddleware<{
		parsedInput: { name: string };
	}>().define(async ({ next }) => {
		return next({ ctx: { greeting: "hello", count: 42 } });
	});

	type NextCtx = InferValidatedMiddlewareFnNextCtx<typeof mw>;
	expectTypeOf<NextCtx>().toEqualTypeOf<{ greeting: string; count: number }>();
});

test("InferValidatedMiddlewareFnNextCtx returns never for non-middleware", () => {
	type Result = InferValidatedMiddlewareFnNextCtx<string>;
	expectTypeOf<Result>().toEqualTypeOf<never>();
});

// ─── InferCtx with middleware chain ──────────────────────────────────

test("InferCtx extracts context from validated middleware", () => {
	const mw = createValidatedMiddleware<{
		parsedInput: string;
		ctx: { db: object; userId: string };
	}>().define(async ({ next }) => next());

	type Ctx = InferCtx<typeof mw>;
	expectTypeOf<Ctx>().toEqualTypeOf<{ db: object; userId: string }>();
});

// ─── InferMetadata with middleware ───────────────────────────────────

test("InferMetadata extracts metadata from validated middleware", () => {
	const mw = createValidatedMiddleware<{
		parsedInput: string;
		metadata: { actionName: string };
	}>().define(async ({ next }) => next());

	type Meta = InferMetadata<typeof mw>;
	expectTypeOf<Meta>().toEqualTypeOf<{ actionName: string }>();
});

// ─── InferServerError with middleware ────────────────────────────────

test("InferServerError extracts server error from validated middleware", () => {
	type CustomError = { code: string; message: string };

	type Mw = ValidatedMiddlewareFn<CustomError, undefined, {}, { extra: boolean }, string, string, readonly [], readonly []>;

	type SE = InferServerError<Mw>;
	expectTypeOf<SE>().toEqualTypeOf<CustomError>();
});

// ─── Standalone validated middleware constraint errors ────────────────

test("createValidatedMiddleware with incompatible parsedInput errors at use site", () => {
	const mwExpectsObject = createValidatedMiddleware<{
		parsedInput: { name: string; age: number };
	}>().define(async ({ next }) => next());

	const ac = createSafeActionClient();

	// Using with a schema that doesn't match the constraint.
	ac.inputSchema(z.string())
		// @ts-expect-error - parsedInput type mismatch: string vs { name: string; age: number }
		.useValidated(mwExpectsObject)
		.action(async () => ({}));
});

// ─── parsedInput undefined with only bindArgsSchemas ─────────────────

test("parsedInput is undefined in useValidated with only bindArgsSchemas", () => {
	const ac = createSafeActionClient();

	ac.bindArgsSchemas([z.number()])
		.useValidated(async ({ parsedInput, bindArgsParsedInputs, next }) => {
			expectTypeOf(parsedInput).toEqualTypeOf<undefined>();
			expectTypeOf(bindArgsParsedInputs).toEqualTypeOf<readonly [number]>();
			return next();
		})
		.action(async () => ({}));
});

// ─── ValidatedMiddlewareFn type parameters ───────────────────────────

test("ValidatedMiddlewareFn type parameters are correctly constrained", () => {
	type TestVMw = ValidatedMiddlewareFn<
		string,
		{ actionName: string },
		{ userId: string },
		{ authorized: boolean },
		{ name: string },
		{ name: string },
		readonly [number],
		readonly [number]
	>;

	const mw: TestVMw = async ({ ctx, metadata, parsedInput, bindArgsParsedInputs, next }) => {
		expectTypeOf(ctx).toEqualTypeOf<{ userId: string }>();
		expectTypeOf(metadata).toEqualTypeOf<{ actionName: string }>();
		expectTypeOf(parsedInput).toEqualTypeOf<{ name: string }>();
		expectTypeOf(bindArgsParsedInputs).toEqualTypeOf<readonly [number]>();
		return next({ ctx: { authorized: true } });
	};

	expectTypeOf(mw).not.toBeAny();
});
