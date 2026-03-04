"use server";

import { z } from "zod";
import { ActionError, action } from "@/lib/safe-action";

const schema = z.object({
	userId: z.string().min(1).max(10),
});

export const deleteUser = action
	.metadata({ actionName: "deleteUser" })
	.inputSchema(schema)
	.action(async ({ parsedInput: { userId } }) => {
		await new Promise((res) => setTimeout(res, 1000));

		if (Math.random() > 0.5) {
			throw new ActionError("Could not delete user!");
		}

		return {
			deletedUserId: userId,
		};
	});
