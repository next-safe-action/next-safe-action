import { expect, it, vi } from "vitest";
import { z } from "zod";
import { createMiddleware, createSafeActionClient } from "../index";

it("describes completed actions once without running middleware, factories or implementations", async () => {
	const callback = vi.fn();
	const middleware = vi.fn(async ({ next }) => next({ ctx: { user: "test" } }));
	const factory = vi.fn(async () => z.string());
	const run = vi.fn(async () => "ok");
	const input = z.string(),
		output = z.string();
	const client = createSafeActionClient({ defineMetadataSchema: () => z.object({ name: z.string() }) })
		.use(createMiddleware().define(middleware, { onActionDefined: callback }))
		.metadata({ name: "test" });
	const action = client.inputSchema(input).outputSchema(output).action(run);
	expect(callback).toHaveBeenCalledExactlyOnceWith({
		action,
		metadata: { name: "test" },
		stateful: false,
		inputSchema: input,
		outputSchema: output,
		dynamicInputSchema: false,
		bindArgsCount: 0,
	});
	expect(Object.isFrozen(callback.mock.calls[0]![0])).toBe(true);
	client.inputSchema(factory).bindArgsSchemas([z.string()]).stateAction(run);
	expect(callback.mock.calls[1]![0]).toMatchObject({
		stateful: true,
		dynamicInputSchema: true,
		inputSchema: undefined,
		bindArgsCount: 1,
	});
	expect(factory).not.toHaveBeenCalled();
	expect(run).not.toHaveBeenCalled();
	expect(middleware).not.toHaveBeenCalled();
	await action("a");
	expect(callback).toHaveBeenCalledTimes(2);
});

it("rejects asynchronous declaration callbacks and propagates configuration errors", () => {
	expect(() => createMiddleware().define(async ({ next }) => next(), { onActionDefined: async () => {} })).toThrow(
		"synchronous"
	);
	const client = createSafeActionClient().use(
		createMiddleware().define(async ({ next }) => next(), {
			onActionDefined: () => {
				throw new Error("configuration");
			},
		})
	);
	expect(() => client.action(async () => {})).toThrow("configuration");
	const thenable = createSafeActionClient().use(
		createMiddleware().define(async ({ next }) => next(), {
			onActionDefined: () => Promise.resolve(),
		})
	);
	expect(() => thenable.action(async () => {})).toThrow("synchronous");
});
