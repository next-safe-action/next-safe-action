import type { StandardSchemaV1 } from "./standard-schema";

/**
 * Shallow-frozen, read-only description of a safe action, attached when `action()` or `stateAction()` defines it.
 */
export type ActionDefinition = Readonly<{
	stateful: boolean;
	inputSchema: StandardSchemaV1 | undefined;
	outputSchema: StandardSchemaV1 | undefined;
	dynamicInputSchema: boolean;
	bindArgsCount: number;
}>;

// `Symbol.for` keeps definitions readable across duplicate copies of this package.
const definitionKey = /* @__PURE__ */ Symbol.for("next-safe-action.action-definition.v1");

export function attachActionDefinition(action: Function, definition: ActionDefinition) {
	Object.defineProperty(action, definitionKey, { value: Object.freeze(definition) });
}

/**
 * Returns the definition of a safe action, or `undefined` for any other value, including bound actions.
 */
export function getActionDefinition(action: unknown): ActionDefinition | undefined {
	if (typeof action !== "function" || !Object.hasOwn(action, definitionKey)) return undefined;
	return (action as unknown as Record<symbol, ActionDefinition>)[definitionKey];
}
