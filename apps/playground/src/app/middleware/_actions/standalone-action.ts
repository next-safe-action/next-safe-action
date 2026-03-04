"use server";

import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from "next-safe-action";
import { z } from "zod";
import { ActionError, loggingMiddleware } from "@/lib/safe-action";

const standaloneClient = createSafeActionClient({
	handleServerError: (e) => {
		if (e instanceof ActionError) return e.message;
		return DEFAULT_SERVER_ERROR_MESSAGE;
	},
	defineMetadataSchema() {
		return z.object({ actionName: z.string() });
	},
}).use(loggingMiddleware);

const schema = z.object({
	text: z.string().min(1).max(200),
});

export const standaloneAction = standaloneClient
	.metadata({ actionName: "standaloneAction" })
	.inputSchema(schema)
	.action(async ({ parsedInput }) => {
		await new Promise((res) => setTimeout(res, 300));
		return {
			processed: parsedInput.text.toUpperCase(),
			length: parsedInput.text.length,
		};
	});
