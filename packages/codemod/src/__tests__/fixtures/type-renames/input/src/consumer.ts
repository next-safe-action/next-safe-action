import type { ErrorsFormat, HookSafeStateActionFn } from "./barrel";

export type A = HookSafeStateActionFn<string, undefined, undefined, unknown>;
export type B = ErrorsFormat;
