import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import { createSafeActionClient } from "../..";
import type { ValidationErrors } from "../../validation-errors.types";

const ac = createSafeActionClient();

test("action with no input schema has undefined parsedInput", () => {
	ac.action(async ({ parsedInput }) => {
		expectTypeOf(parsedInput).toEqualTypeOf<undefined>();
		return {};
	});
});

test("action with input schema infers parsedInput from schema output", () => {
	ac.inputSchema(z.object({ name: z.string(), age: z.number() })).action(async ({ parsedInput }) => {
		expectTypeOf(parsedInput).toEqualTypeOf<{ name: string; age: number }>();
		expectTypeOf(parsedInput).not.toBeAny();
		return {};
	});
});

test("action with input schema requires correct input type", () => {
	const action = ac.inputSchema(z.object({ name: z.string() })).action(async () => {
		return {};
	});

	expectTypeOf(action).parameter(0).toEqualTypeOf<{ name: string }>();
});

test("action with output schema constrains return type and result.data", () => {
	const action = ac.outputSchema(z.object({ id: z.string() })).action(async () => {
		return { id: "123" };
	});

	type Result = Awaited<ReturnType<typeof action>>;
	expectTypeOf<Result["data"]>().toEqualTypeOf<{ id: string } | undefined>();
});

test("action with bind args schemas types bind args correctly in server code", () => {
	ac.bindArgsSchemas([z.string(), z.number()]).action(async ({ bindArgsParsedInputs }) => {
		// Test individual tuple elements
		expectTypeOf(bindArgsParsedInputs[0]).toEqualTypeOf<string>();
		expectTypeOf(bindArgsParsedInputs[1]).toEqualTypeOf<number>();
		expectTypeOf(bindArgsParsedInputs).not.toBeAny();
		return {};
	});
});

test("action with bind args prepends bind args to action signature", () => {
	const action = ac
		.inputSchema(z.object({ name: z.string() }))
		.bindArgsSchemas([z.string(), z.number()])
		.action(async () => {
			return {};
		});

	// First two params are bind args, third is the input
	expectTypeOf(action).parameter(0).toEqualTypeOf<string>();
	expectTypeOf(action).parameter(1).toEqualTypeOf<number>();
	expectTypeOf(action).parameter(2).toEqualTypeOf<{ name: string }>();
});

test("full chain preserves all types", () => {
	const acWithMeta = createSafeActionClient({
		defineMetadataSchema: () => z.object({ actionName: z.string() }),
	});

	acWithMeta
		.use(async ({ next }) => {
			return next({ ctx: { userId: "123" } });
		})
		.metadata({ actionName: "test" })
		.inputSchema(z.object({ email: z.string() }))
		.outputSchema(z.object({ success: z.boolean() }))
		.action(async ({ parsedInput, ctx, metadata }) => {
			expectTypeOf(parsedInput).toEqualTypeOf<{ email: string }>();
			expectTypeOf(parsedInput).not.toBeAny();
			expectTypeOf(ctx).toEqualTypeOf<{ userId: string }>();
			expectTypeOf(ctx).not.toBeAny();
			expectTypeOf(metadata).toEqualTypeOf<{ actionName: string }>();
			expectTypeOf(metadata).not.toBeAny();
			return { success: true };
		});
});

test("action result data and serverError types", () => {
	const action = ac.inputSchema(z.object({ name: z.string() })).action(async () => {
		return { id: "123" };
	});

	type Result = Awaited<ReturnType<typeof action>>;
	expectTypeOf<Result["data"]>().toEqualTypeOf<{ id: string } | undefined>();
	expectTypeOf<Result["serverError"]>().toEqualTypeOf<string | undefined>();
});

test("action result validationErrors match schema shape", () => {
	const schema = z.object({ name: z.string(), age: z.number() });
	const action = ac.inputSchema(schema).action(async () => {
		return {};
	});

	type Result = Awaited<ReturnType<typeof action>>;
	expectTypeOf<Result["validationErrors"]>().toEqualTypeOf<ValidationErrors<typeof schema> | undefined>();
});

test("clientInput in server code uses schema input type", () => {
	ac.inputSchema(z.object({ count: z.string().transform(Number) })).action(async ({ clientInput, parsedInput }) => {
		// clientInput is schema INPUT type (before transform)
		expectTypeOf(clientInput).toEqualTypeOf<{ count: string }>();
		// parsedInput is schema OUTPUT type (after transform)
		expectTypeOf(parsedInput).toEqualTypeOf<{ count: number }>();
		return {};
	});
});

test("custom server error type flows through", () => {
	const customAc = createSafeActionClient({
		handleServerError: () => ({ code: "ERR", message: "fail" }),
	});

	const action = customAc.action(async () => {
		return {};
	});

	type Result = Awaited<ReturnType<typeof action>>;
	expectTypeOf<Result["serverError"]>().toEqualTypeOf<{ code: string; message: string } | undefined>();
});

test("flattened validation errors shape has formErrors and fieldErrors", () => {
	const flatAc = createSafeActionClient({
		defaultValidationErrorsShape: "flattened",
	});

	const action = flatAc.inputSchema(z.object({ name: z.string() })).action(async () => {
		return {};
	});

	type Result = Awaited<ReturnType<typeof action>>;
	type VE = NonNullable<Result["validationErrors"]>;
	expectTypeOf<VE["formErrors"]>().toEqualTypeOf<string[]>();
	expectTypeOf<VE["fieldErrors"]>().not.toBeAny();
});
