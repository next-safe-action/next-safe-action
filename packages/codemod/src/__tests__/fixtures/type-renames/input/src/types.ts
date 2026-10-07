import type { DVES, SafeActionUtils as Callbacks } from "next-safe-action";
import { type HookSafeActionFn, useAction } from "next-safe-action/hooks";
import * as nsa from "next-safe-action";

// TODO: document why DVES is used here.
export type Shape = DVES;
export type Cb = Callbacks<string, undefined, object, undefined, [], undefined, unknown>;
export type Fn = HookSafeActionFn<string, undefined, undefined, unknown>;
export type Fn2 = nsa.StateServerCodeFn<string, undefined, object, undefined, [], undefined, unknown>;
export type Imp = import("next-safe-action").DVES;
export const fnOrShape = (shape: DVES): Shape => shape;
export { useAction };
