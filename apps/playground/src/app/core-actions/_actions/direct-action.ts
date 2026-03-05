"use server";

import { z } from "zod";
import { action } from "@/lib/safe-action";

const schema = z.object({
	username: z.string().min(3).max(10),
	password: z.string().min(8).max(100),
});

export const directAction = action
	.metadata({ actionName: "directAction" })
	.inputSchema(schema)
	.action(async ({ parsedInput: { username, password } }) => {
		if (username === "user" && password === "password") {
			return { success: true };
		}

		return { success: false };
	});
