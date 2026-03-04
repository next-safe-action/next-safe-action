"use server";

import { z } from "zod";
import { action } from "@/lib/safe-action";

const inputSchema = z.object({
	name: z.string().min(1).max(50),
});

const outputSchema = z.object({
	greeting: z.string(),
	timestamp: z.number(),
});

export const outputSchemaAction = action
	.metadata({ actionName: "outputSchemaAction" })
	.inputSchema(inputSchema)
	.outputSchema(outputSchema)
	.action(async ({ parsedInput: { name } }) => {
		await new Promise((res) => setTimeout(res, 300));
		return {
			greeting: `Hello, ${name}!`,
			timestamp: Date.now(),
		};
	});
