import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import { useAction } from "../../hooks";
import { createMiddleware, createSafeActionClient } from "../../index";
import type { InferSafeActionFnResult } from "../../index";

test("preserves middleware, metadata, schemas and hook inference", () => {
	const middleware = createMiddleware<{ metadata: { name: string } }>().define(
		async ({ metadata, next }) => {
			expectTypeOf(metadata.name).toEqualTypeOf<string>();
			return next({ ctx: { userId: 1 } });
		},
		{
			onActionDefined: (definition) => {
				expectTypeOf(definition.metadata).toEqualTypeOf<unknown>();
			},
		}
	);
	const action = createSafeActionClient({ defineMetadataSchema: () => z.object({ name: z.string() }) })
		.use(middleware)
		.metadata({ name: "test" })
		.inputSchema(z.string())
		.outputSchema(z.number())
		.action(async ({ ctx, metadata, parsedInput }) => {
			expectTypeOf(ctx.userId).toEqualTypeOf<number>();
			expectTypeOf(metadata.name).toEqualTypeOf<string>();
			expectTypeOf(parsedInput).toEqualTypeOf<string>();
			return parsedInput.length;
		});
	expectTypeOf<InferSafeActionFnResult<typeof action>["data"]>().toEqualTypeOf<number | undefined>();
	expectTypeOf(useAction(action).execute).toBeCallableWith("input");
});
