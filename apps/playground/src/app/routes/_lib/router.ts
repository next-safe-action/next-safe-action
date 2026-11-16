import { HttpStatus, mergeRouters } from "next-safe-action/routes";
import { z } from "zod";
import { routeCounter } from "../_actions/counter-action";
import { createReport } from "../_actions/create-report-action";
import { reserveUsername } from "../_actions/reserve-username-action";
import { addToTotal } from "../_actions/running-total-action";
import { USERNAME_TAKEN } from "./shared";
import { orgsRouter, todosRouter } from "./subrouters";

// One router, shared by the catch-all route handler and the OpenAPI route, so both always describe the same endpoints.
// Paths are relative to the catch-all folder: "/counter" is served at /api/routes/counter.
// mergeRouters() combines the subrouters into a router with no prefix, and more routes can be chained onto it.
export const router = mergeRouters(todosRouter, orgsRouter)
	.post(routeCounter, "/counter", {
		openapi: { operationId: "incrementCounter", summary: "Increment the cookie counter", tags: ["counter"] },
	})
	.post(reserveUsername, "/usernames", {
		// Statuses are typed literals: `HttpStatus.Created` and `201` are the same value and type.
		successStatus: HttpStatus.Created,
		// Expected server errors get a meaningful status. Everything else stays a 500.
		serverErrorStatus: (error) => (error === USERNAME_TAKEN ? HttpStatus.Conflict : HttpStatus.InternalServerError),
		openapi: {
			operationId: "reserveUsername",
			summary: "Reserve a username",
			tags: ["usernames"],
			// Every status the mapper can return, including the 500 fallback. TypeScript rejects a mapper that returns
			// a status missing from this list.
			serverErrorStatuses: [HttpStatus.Conflict, HttpStatus.InternalServerError],
		},
	})
	.post(addToTotal, "/total", {
		// HTTP clients send `{ input, prevResult }`. `prevResult` is untrusted client data: this schema checks
		// its shape only, so never derive permissions or stored state from it.
		stateSchema: z.object({ data: z.object({ total: z.number().int().nonnegative() }).optional() }),
		openapi: { operationId: "addToTotal", summary: "Add to a running total", tags: ["total"] },
	})
	.post(createReport, "/reports", {
		successStatus: 201,
		openapi: {
			operationId: "createReport",
			summary: "Create a report",
			description: 'Requires the `x-api-key` header. Use "demo-key".',
			tags: ["reports"],
			parameters: [{ name: "x-api-key", in: "header", required: true, schema: { type: "string" } }],
		},
	});
