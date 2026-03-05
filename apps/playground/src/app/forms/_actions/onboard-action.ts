"use server";

import { z } from "zod";
import { action } from "@/lib/safe-action";

const schema = z.object({
	username: z.string().min(3).max(30),
});

const bindArgsSchemas: [userId: z.ZodUUID, age: z.ZodNumber] = [z.uuid(), z.number().min(18).max(150)];

export const onboardUser = action
	.metadata({ actionName: "onboardUser" })
	.inputSchema(schema)
	.bindArgsSchemas(bindArgsSchemas)
	.action(async ({ parsedInput: { username }, bindArgsParsedInputs: [userId, age] }) => {
		await new Promise((res) => setTimeout(res, 1000));
		return {
			message: `Welcome on board, ${username}! (age = ${age}, user id = ${userId})`,
		};
	});
