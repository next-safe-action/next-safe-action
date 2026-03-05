"use server";

import { randomUUID } from "crypto";
import { returnValidationErrors } from "next-safe-action";
import { action } from "@/lib/safe-action";
import { buyProductSchema } from "../_validation/schemas";

export const buyProduct = action
	.metadata({ actionName: "buyProduct" })
	.inputSchema(buyProductSchema)
	.action(async ({ parsedInput: { productId, quantity } }) => {
		await new Promise((res) => setTimeout(res, 500));

		if (productId === "out-of-stock") {
			returnValidationErrors(buyProductSchema, {
				productId: {
					_errors: ["This product is currently out of stock"],
				},
			});
		}

		return {
			productId,
			quantity,
			transactionId: randomUUID(),
			transactionTimestamp: Date.now(),
		};
	});
