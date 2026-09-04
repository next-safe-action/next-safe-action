import { expect, test, vi } from "vitest";
import { z } from "zod";
import { createMiddleware, createSafeActionClient } from "../index";
import type { MiddlewareFn } from "../index";

// ═══════════════════════════════════════════════════════════════════════
// onActionDefined declaration callback runtime tests
// ═══════════════════════════════════════════════════════════════════════

const ac = createSafeActionClient({
	defineMetadataSchema: () => z.object({ name: z.string() }),
	handleServerError(e) {
		return e.message;
	},
});

const passthrough: MiddlewareFn<any, any, object, object> = async ({ next }) => next();

// ─── Definition description ─────────────────────────────────────────

test("describes a completed action once with the declared metadata and direct schemas", async () => {
	const callback = vi.fn();
	const middleware = vi.fn(async ({ next }) => next({ ctx: { user: "test" } }));
	const run = vi.fn(async () => "ok");
	const input = z.string();
	const output = z.string();

	const action = ac
		.use(createMiddleware().define(middleware, { onActionDefined: callback }))
		.metadata({ name: "test" })
		.inputSchema(input)
		.outputSchema(output)
		.action(run);

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
	expect(run).not.toHaveBeenCalled();
	expect(middleware).not.toHaveBeenCalled();

	await action("a");
	expect(callback).toHaveBeenCalledTimes(1);
});

test("describes stateful actions, bind args and dynamic schemas without running factories", () => {
	const callback = vi.fn();
	const factory = vi.fn(async () => z.string());

	ac.use(createMiddleware().define(passthrough, { onActionDefined: callback }))
		.metadata({ name: "test" })
		.inputSchema(factory)
		.bindArgsSchemas([z.string()])
		.stateAction(async () => "ok");

	expect(callback.mock.calls[0]![0]).toMatchObject({
		stateful: true,
		dynamicInputSchema: true,
		inputSchema: undefined,
		bindArgsCount: 1,
	});
	expect(factory).not.toHaveBeenCalled();
});

test("exposes the raw declared metadata, before metadata validation runs", async () => {
	const callback = vi.fn();
	const action = ac
		.use(createMiddleware().define(passthrough, { onActionDefined: callback }))
		.metadata({ name: 1 as unknown as string })
		.action(async () => "ok");

	expect(callback.mock.calls[0]![0].metadata).toEqual({ name: 1 });
	// Validation happens on invocation, not on definition.
	const result = await action();
	expect(result.serverError).toBeDefined();
});

// ─── Schema replacement ─────────────────────────────────────────────

test("tracks the direct input schema through direct, factory and direct replacements", () => {
	const callback = vi.fn();
	const client = ac.use(createMiddleware().define(passthrough, { onActionDefined: callback })).metadata({ name: "x" });
	const first = z.string();
	const last = z.number();

	client.inputSchema(first).action(async () => {});
	client
		.inputSchema(first)
		.inputSchema(async (prev) => prev.max(3))
		.action(async () => {});
	client
		.inputSchema(first)
		.inputSchema(async (prev) => prev.max(3))
		.inputSchema(last)
		.action(async () => {});

	expect(callback.mock.calls.map(([definition]) => [definition.inputSchema, definition.dynamicInputSchema])).toEqual([
		[first, false],
		[undefined, true],
		[last, false],
	]);
});

// ─── Middleware identity ────────────────────────────────────────────

test("notifies a repeated middleware once while still executing it twice", async () => {
	const callback = vi.fn();
	const runs = vi.fn(async ({ next }) => next());
	const mw = createMiddleware().define(runs, { onActionDefined: callback });

	const action = ac
		.use(mw)
		.use(mw)
		.metadata({ name: "x" })
		.action(async () => "ok");
	expect(callback).toHaveBeenCalledTimes(1);

	await action();
	expect(runs).toHaveBeenCalledTimes(2);
});

test("notifies each decorated wrapper separately", () => {
	const callback = vi.fn();
	const decorate = () => createMiddleware().define(passthrough, { onActionDefined: callback });

	ac.use(decorate())
		.use(decorate())
		.metadata({ name: "x" })
		.action(async () => "ok");
	expect(callback).toHaveBeenCalledTimes(2);
});

test("does not wrap middleware without a callback", () => {
	expect(createMiddleware().define(passthrough)).toBe(passthrough);
});

// ─── Synchronous contract ───────────────────────────────────────────

test("rejects async declaration callbacks at define time", () => {
	expect(() => createMiddleware().define(passthrough, { onActionDefined: async () => {} })).toThrow("synchronous");
});

test("rejects promise-returning callbacks at definition time and swallows the promise", async () => {
	const rejection = vi.fn();
	process.once("unhandledRejection", rejection);
	const client = ac.use(
		createMiddleware().define(passthrough, { onActionDefined: () => Promise.reject(new Error("later")) })
	);

	expect(() => client.metadata({ name: "x" }).action(async () => {})).toThrow("synchronous");
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(rejection).not.toHaveBeenCalled();
});

test("propagates configuration errors thrown by the callback", () => {
	const client = ac.use(
		createMiddleware().define(passthrough, {
			onActionDefined: () => {
				throw new Error("configuration");
			},
		})
	);
	expect(() => client.metadata({ name: "x" }).action(async () => {})).toThrow("configuration");
});
