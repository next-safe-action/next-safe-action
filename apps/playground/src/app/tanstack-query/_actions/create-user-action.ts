"use server";

import { randomUUID } from "crypto";
import { returnValidationErrors } from "next-safe-action";
import { action } from "@/lib/safe-action";
import { createUserSchema } from "../_validation/schemas";

export const createUser = action
	.metadata({ actionName: "createUser" })
	.inputSchema(createUserSchema)
	.action(async ({ parsedInput: { name, email } }) => {
		await new Promise((res) => setTimeout(res, 500));

		if (email === "taken@example.com") {
			returnValidationErrors(createUserSchema, {
				email: {
					_errors: ["This email is already taken"],
				},
			});
		}

		return {
			id: randomUUID(),
			name,
			email,
			createdAt: Date.now(),
		};
	});
