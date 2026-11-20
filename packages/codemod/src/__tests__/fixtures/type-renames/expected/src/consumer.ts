import type { ErrorsFormat, SingleInputStateActionFn } from "./barrel";

export type A = SingleInputStateActionFn<string, undefined, undefined, unknown>;
export type B = ErrorsFormat;
