"use server";

import { z } from "zod";
import { actionClient } from "../_lib/route-client";

export const createTodo = actionClient
	.inputSchema(z.object({ title: z.string().min(1) }))
	.outputSchema(z.object({ id: z.string(), title: z.string(), done: z.boolean() }))
	.action(async ({ parsedInput }) => {
		// Demonstration only: nothing is stored.
		return { id: crypto.randomUUID(), title: parsedInput.title, done: false };
	});
