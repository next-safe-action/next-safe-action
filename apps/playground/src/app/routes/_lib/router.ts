import { createRouter } from "@next-safe-action/adapter-routes";
import { z } from "zod";
import { routeCounter } from "../_actions/counter-action";
import { createReport } from "../_actions/create-report-action";
import { reserveUsername } from "../_actions/reserve-username-action";
import { addToTotal } from "../_actions/running-total-action";
import { updateTodo } from "../_actions/update-todo-action";
import { todoBodySchema, USERNAME_TAKEN } from "./shared";

// One router, shared by the catch-all route handler and the OpenAPI route, so both always describe the same endpoints.
// Paths are relative to the catch-all folder: "/counter" is served at /api/routes/counter.
export const router = createRouter()
	.post("/counter", routeCounter, {
		openapi: { operationId: "incrementCounter", summary: "Increment the cookie counter", tags: ["counter"] },
	})
	.patch("/todos/{id}", updateTodo, {
		// Merge the path parameter into the JSON body. It is spread last, so the URL always wins over a body `id`.
		// The merged value still goes through the action's input schema, like any other input.
		mapInput: ({ input, params }) => ({ ...(input as object), id: params.id }),
		openapi: {
			operationId: "updateTodo",
			summary: "Update a todo",
			tags: ["todos"],
			// `mapInput` changes the input shape, so the HTTP body and the parameters are documented explicitly.
			requestBodySchema: z.toJSONSchema(todoBodySchema, { io: "input" }),
			parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
		},
	})
	.post("/usernames", reserveUsername, {
		successStatus: 201,
		// Expected server errors get a meaningful status. Everything else stays a 500.
		serverErrorStatus: (error) => (error === USERNAME_TAKEN ? 409 : 500),
		openapi: {
			operationId: "reserveUsername",
			summary: "Reserve a username",
			tags: ["usernames"],
			// Every status the mapper can return, including the 500 fallback.
			serverErrorStatuses: [409, 500],
		},
	})
	.post("/total", addToTotal, {
		// HTTP clients send `{ input, prevResult }`. `prevResult` is untrusted client data: this schema checks
		// its shape only, so never derive permissions or stored state from it.
		stateSchema: z.object({ data: z.object({ total: z.number().int().nonnegative() }).optional() }),
		openapi: { operationId: "addToTotal", summary: "Add to a running total", tags: ["total"] },
	})
	.post("/reports", createReport, {
		successStatus: 201,
		openapi: {
			operationId: "createReport",
			summary: "Create a report",
			description: 'Requires the `x-api-key` header. Use "demo-key".',
			tags: ["reports"],
			parameters: [{ name: "x-api-key", in: "header", required: true, schema: { type: "string" } }],
		},
	});
