import { expectTypeOf, test } from "vitest";
import { createSafeActionClient, getActionDefinition } from "../../index";
import type { ActionDefinition } from "../../index";

test("getActionDefinition accepts any value and may return undefined", () => {
	const action = createSafeActionClient().action(async () => "ok");
	expectTypeOf(getActionDefinition(action)).toEqualTypeOf<ActionDefinition | undefined>();
	expectTypeOf(getActionDefinition).parameter(0).toEqualTypeOf<unknown>();
});
