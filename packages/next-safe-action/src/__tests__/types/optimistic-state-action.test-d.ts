// Verifies the `useOptimisticStateAction` return type: `optimisticState` is the confirmed domain
// state (never `Data | undefined`), and intersecting it with the status union preserves narrowing.

import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import { useOptimisticStateAction } from "../../hooks";
import type { UseOptimisticStateActionHookReturn, UseStateActionHookReturn } from "../../hooks.types";
import type { SafeStateActionFn } from "../../index.types";
import type { ValidationErrors } from "../../validation-errors.types";

const schema = z.object({ name: z.string() });

type Data = { id: string }[];
type ServerError = string;
type Shape = ValidationErrors<typeof schema>;
type State = { id: string }[];
type Return = UseOptimisticStateActionHookReturn<ServerError, typeof schema, Shape, Data, State>;

// ─── optimisticState ────────────────────────────────────────────────────────

test("optimisticState is exactly State, never undefined", () => {
	expectTypeOf<Return["optimisticState"]>().toEqualTypeOf<State>();
	expectTypeOf<Return["optimisticState"]>().not.toBeNullable();
});

test("State is independent of Data", () => {
	type Pending = { kind: "move"; id: string }[];
	type ListReturn = UseOptimisticStateActionHookReturn<ServerError, typeof schema, Shape, void, Pending>;
	expectTypeOf<ListReturn["optimisticState"]>().toEqualTypeOf<Pending>();
});

// ─── Structure ──────────────────────────────────────────────────────────────

test("extends UseStateActionHookReturn, so formAction is present", () => {
	expectTypeOf<Return>().toMatchTypeOf<UseStateActionHookReturn<ServerError, typeof schema, Shape, Data>>();
	expectTypeOf<Return["formAction"]>().not.toBeAny();
	expectTypeOf<Return["reset"]>().toEqualTypeOf<() => void>();
});

test("narrowing on status still narrows result", () => {
	const r = {} as Return;

	if (r.status === "hasSucceeded") {
		expectTypeOf(r.result.data).toEqualTypeOf<Data>();
		// `optimisticState` survives the narrowing.
		expectTypeOf(r.optimisticState).toEqualTypeOf<State>();
	}

	if (r.status === "hasErrored") {
		expectTypeOf(r.result.validationErrors).toEqualTypeOf<Shape | undefined>();
	}
});

// ─── Inference from a real call ─────────────────────────────────────────────

test("infers State from currentState and Data from the action", () => {
	const stateActionFn = {} as SafeStateActionFn<ServerError, typeof schema, [], Shape, Data>;
	const currentState: State = [];

	const hook = useOptimisticStateAction(stateActionFn, {
		currentState,
		updateFn: (state, input) => {
			expectTypeOf(state).toEqualTypeOf<State>();
			expectTypeOf(input).toEqualTypeOf<{ name: string }>();
			return state;
		},
	});

	expectTypeOf(hook.optimisticState).toEqualTypeOf<State>();
	expectTypeOf(hook.execute).toBeCallableWith({ name: "x" });
});

test("initResult narrows the idle branch, independently of currentState", () => {
	type Seeded = UseOptimisticStateActionHookReturn<ServerError, typeof schema, Shape, Data, State, { data: Data }>;
	const r = {} as Seeded;

	if (r.status === "idle") {
		expectTypeOf(r.result.data).toEqualTypeOf<Data>();
	}
});
