"use server";

import { returnServerError } from "next-safe-action";
import { z } from "zod";
import { routeClient } from "../_lib/route-client";

const USERNAME_TAKEN = "Username is already taken";
const takenUsernames = new Set(["admin", "root"]);

export const reserveUsername = routeClient
	.metadata({
		endpoint: {
			method: "POST",
			path: "/usernames",
			successStatus: 201,
			// Expected server errors get a meaningful status. Everything else stays a 500.
			serverErrorStatus: (error) => (error === USERNAME_TAKEN ? 409 : 500),
			openapi: {
				operationId: "reserveUsername",
				summary: "Reserve a username",
				tags: ["usernames"],
				// Every status the mapper can return, including the 500 fallback.
				serverErrorStatuses: [409, 500],
			},
		},
	})
	.inputSchema(z.object({ username: z.string().min(3).max(20) }))
	.outputSchema(z.object({ username: z.string() }))
	.action(async ({ parsedInput: { username } }) => {
		if (takenUsernames.has(username)) {
			returnServerError(USERNAME_TAKEN);
		}

		// Demonstration only: nothing is stored.
		return { username };
	});
