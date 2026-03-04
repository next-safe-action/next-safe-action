"use server";

import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from "next-safe-action";
import { z } from "zod";
import { ActionError, DatabaseError, errorHandlingMiddleware } from "@/lib/safe-action";

const errorClient = createSafeActionClient({
	handleServerError: (e) => {
		if (e instanceof ActionError) return e.message;
		return DEFAULT_SERVER_ERROR_MESSAGE;
	},
	defineMetadataSchema() {
		return z.object({ actionName: z.string() });
	},
}).use(errorHandlingMiddleware);

const schema = z.object({
	simulateError: z.boolean(),
});

export const errorHandlingAction = errorClient
	.metadata({ actionName: "errorHandlingAction" })
	.inputSchema(schema)
	.action(async ({ parsedInput }) => {
		if (parsedInput.simulateError) {
			throw new DatabaseError("Connection refused to database at port 5432");
		}

		return {
			message: "Operation completed successfully",
		};
	});
