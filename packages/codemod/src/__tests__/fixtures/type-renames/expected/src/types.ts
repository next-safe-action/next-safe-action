import type { ValidationErrorsFormat, ActionCallbacks as Callbacks } from "next-safe-action";
import { type SingleInputActionFn, useAction } from "next-safe-action/hooks";
import * as nsa from "next-safe-action";

// TODO: document why DVES is used here.
export type Shape = ValidationErrorsFormat;
export type Cb = Callbacks<string, undefined, object, undefined, [], undefined, unknown>;
export type Fn = SingleInputActionFn<string, undefined, undefined, unknown>;
export type Fn2 = nsa.StatefulServerCodeFn<string, undefined, object, undefined, [], undefined, unknown>;
export type Imp = import("next-safe-action").ValidationErrorsFormat;
export const fnOrShape = (shape: ValidationErrorsFormat): Shape => shape;
export { useAction };
