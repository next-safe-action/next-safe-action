import type { ActionCallbacks as SafeActionUtils } from "next-safe-action";

type ActionCallbacks = { local: true };

export type A = SafeActionUtils<string, undefined, object, undefined, [], undefined, unknown> | ActionCallbacks;
