import { expectTypeOf, test } from "vitest";
import { getActionDefinition } from "../../action-definition";
import type { ActionDefinition } from "../../action-definition";
import { createSafeActionClient } from "../../index";

test("getActionDefinition accepts any value and may return undefined", () => {
	const action = createSafeActionClient().action(async () => "ok");
	expectTypeOf(getActionDefinition(action)).toEqualTypeOf<ActionDefinition | undefined>();
	expectTypeOf(getActionDefinition).parameter(0).toEqualTypeOf<unknown>();
});
