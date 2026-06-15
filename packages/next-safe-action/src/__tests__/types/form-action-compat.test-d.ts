import { expectTypeOf, test } from "vitest";
import type { FormHTMLAttributes } from "react";
import { z } from "zod";
import { createSafeActionClient } from "../..";

// Regression tests for issue #372:
// A safe action passed directly to <form action={...}> should be type-compatible.
//
// React's form `action` prop is typed as:
//   string | undefined | ((formData: FormData) => void | Promise<void>) | DO_NOT_USE...
//
// SafeActionFn returns Promise<SafeActionResult> (not Promise<void>), so without
// augmenting DO_NOT_USE_OR_YOU_WILL_BE_FIRED_EXPERIMENTAL_FORM_ACTIONS, passing a
// safe action directly to the form action prop produces a TS error.

type FormActionProp = FormHTMLAttributes<HTMLFormElement>["action"];

const ac = createSafeActionClient();

test("safe action with FormData input is assignable to the form element action prop", () => {
	const action = ac
		.inputSchema(z.custom<FormData>())
		.action(async () => {});

	// This MUST compile without error (issue #372)
	expectTypeOf(action).toMatchTypeOf<FormActionProp>();
});

test("safe action with no schema is assignable to the form element action prop", () => {
	const action = ac.action(async () => {});

	expectTypeOf(action).toMatchTypeOf<FormActionProp>();
});
