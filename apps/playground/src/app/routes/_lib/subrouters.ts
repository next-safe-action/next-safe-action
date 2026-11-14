import { createRouter } from "next-safe-action/routes";
import { z } from "zod";
import { completeTodo } from "../_actions/complete-todo-action";
import { createTodo } from "../_actions/create-todo-action";
import { inviteMember } from "../_actions/invite-member-action";
import { updateTodo } from "../_actions/update-todo-action";

// Each subrouter groups the routes of one feature under a prefix, and route paths are relative to it. In a larger
// app, each subrouter would live next to its feature. `router.ts` merges them into the router that gets served.
export const todosRouter = createRouter({ prefix: "/todos" })
	// The route "/" maps to the prefix itself: POST /todos.
	.post(createTodo, "/", {
		successStatus: 201,
		openapi: { operationId: "createTodo", summary: "Create a todo", tags: ["todos"] },
	})
	// `{id}` is merged into the JSON body automatically and wins over a body `id`. TypeScript checks that `id` is a
	// string key of the action input, and the OpenAPI document derives the path parameter and the body from the schema.
	.patch(updateTodo, "/{id}", {
		openapi: { operationId: "updateTodo", summary: "Update a todo", tags: ["todos"] },
	})
	// `mapInput` is the escape hatch: here it renames the `{todoId}` URL parameter to the action's `id` key. With
	// `mapInput` there is no automatic merge or derivation, so the HTTP request is documented explicitly.
	.post(completeTodo, "/{todoId}/complete", {
		mapInput: ({ params }) => ({ id: params.todoId }),
		openapi: {
			operationId: "completeTodo",
			summary: "Complete a todo",
			tags: ["todos"],
			requestBodySchema: z.toJSONSchema(z.object({}), { io: "input" }),
			parameters: [{ name: "todoId", in: "path", required: true, schema: { type: "string" } }],
		},
	});

// A prefix can have parameters. They merge into the input like route parameters, so `orgId` must be a string key of the
// action input, even though the route path "/invites" has no parameters of its own.
export const orgsRouter = createRouter({ prefix: "/orgs/{orgId}" }).post(inviteMember, "/invites", {
	successStatus: 201,
	openapi: { operationId: "inviteMember", summary: "Invite a member to an organization", tags: ["orgs"] },
});
