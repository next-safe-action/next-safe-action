"use server";

import { z } from "zod";
import { action } from "@/lib/safe-action";

const schema = z
	.object({
		user: z.object({
			id: z.uuid(),
		}),
		product: z.object({
			deeplyNested: z.object({
				id: z.uuid(),
			}),
		}),
	})
	.superRefine((_, ctx) => {
		// Randomly generate validation error for root.
		if (Math.random() > 0.5) {
			ctx.addIssue({
				code: "custom",
				message: "Parent schema error",
			});
		}

		// Randomly generate validation error for user object.
		if (Math.random() > 0.5) {
			ctx.addIssue({
				code: "custom",
				path: ["user"],
				message: "Parent user error",
			});
			ctx.addIssue({
				code: "custom",
				path: ["user"],
				message: "Parent user error 2",
			});
		}

		// Randomly generate validation error for user id.
		if (Math.random() > 0.5) {
			ctx.addIssue({
				code: "custom",
				path: ["user", "id"],
				message: "Another bad user id error",
			});
		}

		// Randomly generate validation errors for product object.
		if (Math.random() > 0.5) {
			ctx.addIssue({
				code: "custom",
				path: ["product"],
				message: "Parent product error",
			});

			ctx.addIssue({
				code: "custom",
				path: ["product", "deeplyNested"],
				message: "Deeply nested product error",
			});

			ctx.addIssue({
				code: "custom",
				path: ["product", "deeplyNested", "id"],
				message: "Product not found in the store",
			});
		}
	});

export const buyProduct = action
	.metadata({ actionName: "buyProduct" })
	.inputSchema(schema)
	.action(async () => {
		return {
			success: true,
		};
	});
