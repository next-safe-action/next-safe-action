"use server";

import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";
import { action } from "@/lib/safe-action";

async function getSchema() {
	return z.object({
		username: z.string().min(3).max(10),
		password: z.string().min(8).max(100),
	});
}

export const asyncSchemaAction = action
	.metadata({ actionName: "asyncSchemaAction" })
	.inputSchema(getSchema)
	.action(async ({ parsedInput: { username, password } }) => {
		if (username === "user" && password === "password") {
			return { success: true };
		}

		returnValidationErrors(getSchema, {
			username: {
				_errors: ["incorrect_credentials"],
			},
		});
	});
