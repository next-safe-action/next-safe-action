"use server";

import { z } from "zod";
import { actionClient } from "../_lib/route-client";

export const completeTodo = actionClient
	.inputSchema(z.object({ id: z.string() }))
	.outputSchema(z.object({ id: z.string(), done: z.literal(true) }))
	.action(async ({ parsedInput }) => {
		// Demonstration only: nothing is stored.
		return { id: parsedInput.id, done: true as const };
	});
