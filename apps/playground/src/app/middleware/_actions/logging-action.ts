"use server";

import { z } from "zod";
import { action } from "@/lib/safe-action";

const schema = z.object({
	message: z.string().min(1).max(100),
});

export const loggingAction = action
	.metadata({ actionName: "loggingAction" })
	.inputSchema(schema)
	.action(async ({ parsedInput }) => {
		await new Promise((res) => setTimeout(res, 500));
		return {
			echo: parsedInput.message,
			timestamp: new Date().toISOString(),
		};
	});
