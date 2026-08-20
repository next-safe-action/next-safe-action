"use server";

import { action } from "@/lib/safe-action";
import type { Item } from "../_lib/reorder";
import { INITIAL_ITEMS, moveSchema, reorder } from "../_lib/reorder";

// Stands in for the database.
let stored: Item[] = INITIAL_ITEMS;
export const getItems = async () => stored;

export const moveItem = action
	.metadata({ actionName: "moveItem" })
	.inputSchema(moveSchema)
	.stateAction(async ({ parsedInput }, { prevResult }) => {
		// Slow enough to click through, so overlapping dispatches are easy to trigger.
		await new Promise((res) => setTimeout(res, 1200));

		// Always defined: `useOptimisticStateAction` substitutes the last confirmed state when a
		// dispatch fails, so one rejected write can't leave the queue without a base.
		const next = reorder(prevResult.data!, parsedInput);
		stored = next;
		return next;
	});
