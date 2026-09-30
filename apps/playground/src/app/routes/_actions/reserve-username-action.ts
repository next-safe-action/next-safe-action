"use server";

import { returnServerError } from "next-safe-action";
import { z } from "zod";
import { actionClient } from "../_lib/route-client";
import { USERNAME_TAKEN } from "../_lib/shared";

const takenUsernames = new Set(["admin", "root"]);

export const reserveUsername = actionClient
	.inputSchema(z.object({ username: z.string().min(3).max(20) }))
	.outputSchema(z.object({ username: z.string() }))
	.action(async ({ parsedInput: { username } }) => {
		if (takenUsernames.has(username)) {
			returnServerError(USERNAME_TAKEN);
		}

		// Demonstration only: nothing is stored.
		return { username };
	});
