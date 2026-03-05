"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { ActionError, action } from "@/lib/safe-action";
import { addItemSchema } from "../_validation/schemas";

export type Item = z.infer<typeof addItemSchema> & { id: string };

let items: Item[] = [];
export const getItems = async () => items;

export const addItem = action
	.metadata({ actionName: "addItem" })
	.inputSchema(addItemSchema)
	.action(async ({ parsedInput }) => {
		await new Promise((res) => setTimeout(res, 500));

		if (Math.random() > 0.7) {
			throw new ActionError("Random server error — please try again.");
		}

		const item = { ...parsedInput, id: crypto.randomUUID() };
		items.push(item);
		revalidatePath("/react-hook-form");

		return { newItem: item };
	});
