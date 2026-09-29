"use server";

import { z } from "zod";
import { apiKeyClient } from "../_lib/route-client";

export const createReport = apiKeyClient
	.metadata({
		endpoint: {
			method: "POST",
			path: "/reports",
			successStatus: 201,
			openapi: {
				operationId: "createReport",
				summary: "Create a report",
				description: 'Requires the `x-api-key` header. Use "demo-key".',
				tags: ["reports"],
				parameters: [{ name: "x-api-key", in: "header", required: true, schema: { type: "string" } }],
			},
		},
	})
	.inputSchema(z.object({ title: z.string().min(1) }))
	.outputSchema(z.object({ title: z.string(), createdBy: z.string() }))
	.action(async ({ parsedInput, ctx }) => {
		return { title: parsedInput.title, createdBy: ctx.apiClient };
	});
