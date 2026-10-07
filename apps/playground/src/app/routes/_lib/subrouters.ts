import { createRouter } from "@next-safe-action/adapter-routes";
import { z } from "zod";
import { createTodo } from "../_actions/create-todo-action";
import { inviteMember } from "../_actions/invite-member-action";
import { updateTodo } from "../_actions/update-todo-action";
import { inviteBodySchema, todoBodySchema } from "./shared";

// Each subrouter groups the routes of one feature under a prefix, and route paths are relative to it. In a larger
// app, each subrouter would live next to its feature. `router.ts` merges them into the router that gets served.
export const todosRouter = createRouter({ prefix: "/todos" })
	// The route "/" maps to the prefix itself: POST /todos.
	.post("/", createTodo, {
		successStatus: 201,
		openapi: { operationId: "createTodo", summary: "Create a todo", tags: ["todos"] },
	})
	.patch("/{id}", updateTodo, {
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
	});

// A prefix can have parameters. `params.orgId` is typed in mapInput, and mapInput is required, even though the route
// path "/invites" has no parameters of its own.
export const orgsRouter = createRouter({ prefix: "/orgs/{orgId}" }).post("/invites", inviteMember, {
	successStatus: 201,
	// The body is untrusted: the cast only satisfies the return type, and the action's input schema still validates it.
	mapInput: ({ input, params }) => ({ ...(input as { email: string }), orgId: params.orgId }),
	openapi: {
		operationId: "inviteMember",
		summary: "Invite a member to an organization",
		tags: ["orgs"],
		requestBodySchema: z.toJSONSchema(inviteBodySchema, { io: "input" }),
		parameters: [{ name: "orgId", in: "path", required: true, schema: { type: "string" } }],
	},
});
