"use server";

import { z } from "zod";
import { throwingAction } from "@/lib/safe-action";

const schema = z.object({
	email: z.string().email(),
	age: z.number().min(18).max(120),
});

export const throwingValidationAction = throwingAction
	.metadata({ actionName: "throwingValidationAction" })
	.inputSchema(schema)
	.action(async ({ parsedInput }) => {
		return {
			message: `Valid: ${parsedInput.email}, age ${parsedInput.age}`,
		};
	});
