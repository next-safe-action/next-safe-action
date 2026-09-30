"use server";

import { z } from "zod";
import { apiKeyClient } from "../_lib/route-client";

export const createReport = apiKeyClient
	.inputSchema(z.object({ title: z.string().min(1) }))
	.outputSchema(z.object({ title: z.string(), createdBy: z.string() }))
	.action(async ({ parsedInput, ctx }) => {
		return { title: parsedInput.title, createdBy: ctx.apiClient };
	});
