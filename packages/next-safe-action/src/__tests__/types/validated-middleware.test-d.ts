import { expectTypeOf, test } from "vitest";
import { z } from "zod";
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
