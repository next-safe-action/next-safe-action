"use server";

import { flattenValidationErrors, returnValidationErrors } from "next-safe-action";
import { z } from "zod";
import { action } from "@/lib/safe-action";

const schema = z.object({
	email: z.string().email(),
	name: z.string().min(2).max(50),
});

export const customShapeAction = action
	.metadata({ actionName: "customShapeAction" })
	.inputSchema(schema, {
		handleValidationErrorsShape: async (ve) => {
			const flattened = flattenValidationErrors(ve);
			return {
				errorCount: Object.keys(flattened.fieldErrors).length + flattened.formErrors.length,
				fields: flattened.fieldErrors,
				summary: [...flattened.formErrors, ...Object.values(flattened.fieldErrors).flat()].join("; "),
			};
		},
	})
	.action(async ({ parsedInput: { email, name } }) => {
		if (name === "admin") {
			returnValidationErrors(schema, {
				name: {
					_errors: ["reserved_name"],
				},
			});
		}

		return {
			greeting: `Hello, ${name} (${email})!`,
		};
	});
