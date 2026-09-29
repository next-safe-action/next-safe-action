"use server";

import { z } from "zod";
import { routeClient } from "../_lib/route-client";

export const addToTotal = routeClient
	.metadata({
		endpoint: {
			method: "POST",
			path: "/total",
			// HTTP clients send `{ input, prevResult }`. `prevResult` is untrusted client data: this schema checks
			// its shape only, so never derive permissions or stored state from it.
			stateSchema: z.object({ data: z.object({ total: z.number().int().nonnegative() }).optional() }),
			openapi: { operationId: "addToTotal", summary: "Add to a running total", tags: ["total"] },
		},
	})
	.inputSchema(z.object({ amount: z.number().int().min(1).max(100) }))
	.outputSchema(z.object({ total: z.number().int().nonnegative() }))
	.stateAction(async ({ parsedInput }, { prevResult }) => {
		return { total: (prevResult.data?.total ?? 0) + parsedInput.amount };
	});
