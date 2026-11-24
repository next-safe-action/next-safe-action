import { expect, test, vi } from "vitest";
import { z } from "zod";
import { getActionDefinition } from "../action-definition";
import { createSafeActionClient } from "../index";

// ═══════════════════════════════════════════════════════════════════════
// getActionDefinition runtime tests
// ═══════════════════════════════════════════════════════════════════════

const ac = createSafeActionClient({
	defineMetadataSchema: () => z.object({ name: z.string() }),
	handleServerError(e) {
		return e.message;
	},
});

test("describes an action with its direct schemas without running it", async () => {
	const middleware = vi.fn(async ({ next }) => next({ ctx: { user: "test" } }));
	const run = vi.fn(async () => "ok");
	const input = z.string();
	const output = z.string();

	const action = ac.use(middleware).metadata({ name: "test" }).inputSchema(input).outputSchema(output).action(run);
	const definition = getActionDefinition(action);

	expect(definition).toEqual({
		stateful: false,
		inputSchema: input,
		outputSchema: output,
		dynamicInputSchema: false,
		bindArgsCount: 0,
	});
	expect(Object.isFrozen(definition)).toBe(true);
	expect(Object.keys(action)).toEqual([]);
	expect(run).not.toHaveBeenCalled();
	expect(middleware).not.toHaveBeenCalled();
});

test("describes stateful actions, bind args and dynamic schemas without running factories", () => {
	const factory = vi.fn(async () => z.string());

	const action = ac
		.metadata({ name: "test" })
		.inputSchema(factory)
		.bindArgsSchemas([z.string()])
		.stateAction(async () => "ok");

	expect(getActionDefinition(action)).toMatchObject({
		stateful: true,
		dynamicInputSchema: true,
		inputSchema: undefined,
		bindArgsCount: 1,
	});
	expect(factory).not.toHaveBeenCalled();
});

test("tracks the direct input schema through direct, factory and direct replacements", () => {
	const client = ac.metadata({ name: "x" });
	const first = z.string();
	const last = z.number();

	const actions = [
		client.inputSchema(first).action(async () => {}),
		client
			.inputSchema(first)
			.inputSchema(async (prev) => prev.max(3))
			.action(async () => {}),
		client
			.inputSchema(first)
			.inputSchema(async (prev) => prev.max(3))
			.inputSchema(last)
			.action(async () => {}),
	];

	expect(
		actions.map((action) => [getActionDefinition(action)?.inputSchema, getActionDefinition(action)?.dynamicInputSchema])
	).toEqual([
		[first, false],
		[undefined, true],
		[last, false],
	]);
});

test("returns undefined for bound actions and other values", () => {
	const action = ac.metadata({ name: "x" }).action(async () => "ok");

	expect(getActionDefinition(action.bind(null))).toBeUndefined();
	expect(getActionDefinition(async () => "ok")).toBeUndefined();
	expect(getActionDefinition(undefined)).toBeUndefined();
	expect(getActionDefinition({})).toBeUndefined();
});
