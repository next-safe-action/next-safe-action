"use server";

import { z } from "zod";
import { authAction } from "@/lib/safe-action";

const schema = z.object({
	fullName: z.string().min(3).max(20),
	age: z.string().min(2).max(3),
});

export const authContextAction = authAction
	.metadata({ actionName: "authContextAction" })
	.inputSchema(schema)
	.action(async ({ parsedInput: { fullName, age }, ctx: { userId, sessionId } }) => {
		const intAge = parseInt(age);

		return {
			newFullName: fullName,
			newAge: Number.isNaN(intAge) ? null : intAge,
			userId,
			sessionId,
		};
	});
