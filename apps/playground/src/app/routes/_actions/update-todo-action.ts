"use server";

import { z } from "zod";
import { actionClient } from "../_lib/route-client";
import { todoBodySchema } from "../_lib/shared";

export const updateTodo = actionClient
	.inputSchema(todoBodySchema.extend({ id: z.string() }))
	.outputSchema(todoBodySchema.extend({ id: z.string() }))
	.action(async ({ parsedInput }) => {
		// Demonstration only: nothing is stored, the merged input is returned as is.
		return parsedInput;
	});
