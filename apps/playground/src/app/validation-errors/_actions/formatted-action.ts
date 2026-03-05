"use server";

import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";
import { action } from "@/lib/safe-action";

const schema = z.object({
	username: z.string().min(3).max(10),
	password: z.string().min(8).max(100),
});

export const formattedAction = action
	.metadata({ actionName: "formattedAction" })
	.inputSchema(schema)
	.action(async ({ parsedInput: { username, password } }) => {
		if (username === "johndoe") {
			returnValidationErrors(schema, {
				username: {
					_errors: ["user_suspended"],
				},
			});
		}

		if (username === "user" && password === "password") {
			return { success: true };
		}

		returnValidationErrors(schema, {
			username: {
				_errors: ["incorrect_credentials"],
			},
		});
	});
