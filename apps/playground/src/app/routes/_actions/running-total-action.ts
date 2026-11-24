"use server";

import { z } from "zod";
import { actionClient } from "../_lib/route-client";

export const addToTotal = actionClient
	.inputSchema(z.object({ amount: z.number().int().min(1).max(100) }))
	.outputSchema(z.object({ total: z.number().int().nonnegative() }))
	.stateAction(async ({ parsedInput }, { prevResult }) => {
		return { total: (prevResult.data?.total ?? 0) + parsedInput.amount };
	});
