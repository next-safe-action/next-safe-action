"use server";

import { z } from "zod";
import { authAction, rateLimitMiddleware } from "@/lib/safe-action";

const schema = z.object({
	value: z.string().min(1),
});

export const rateLimitAction = authAction
	.use(rateLimitMiddleware)
	.metadata({ actionName: "rateLimitAction" })
	.inputSchema(schema)
	.action(async ({ parsedInput, ctx }) => {
		return {
			value: parsedInput.value,
			userId: ctx.userId,
			timestamp: new Date().toISOString(),
		};
	});
