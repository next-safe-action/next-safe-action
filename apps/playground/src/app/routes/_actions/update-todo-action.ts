"use server";

import { z } from "zod";
import { routeClient } from "../_lib/route-client";

const bodySchema = z.object({
	title: z.string().min(1).optional(),
	done: z.boolean().optional(),
});

export const updateTodo = routeClient
	.metadata({
		endpoint: {
			method: "PATCH",
			path: "/todos/{id}",
			// Merge the path parameter into the JSON body. It is spread last, so the URL always wins over a body `id`.
			// The merged value still goes through `inputSchema`, like any other input.
			mapInput: ({ input, params }) => ({ ...(input as object), id: params.id }),
			openapi: {
				operationId: "updateTodo",
				summary: "Update a todo",
				tags: ["todos"],
				// `mapInput` changes the input shape, so the HTTP body and the parameters are documented explicitly.
				requestBodySchema: z.toJSONSchema(bodySchema, { io: "input" }),
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
			},
		},
	})
	.inputSchema(bodySchema.extend({ id: z.string() }))
	.outputSchema(bodySchema.extend({ id: z.string() }))
	.action(async ({ parsedInput }) => {
		// Demonstration only: nothing is stored, the merged input is returned as is.
		return parsedInput;
	});
