"use server";

import { z } from "zod";
import { authAction } from "@/lib/safe-action";

const schema = z.object({
	postId: z.string().min(1, "Post ID is required"),
});

// Simulated database of posts with their author IDs.
const posts = new Map([
	["post-1", { id: "post-1", title: "Getting started with next-safe-action", authorId: "allowed" }],
	["post-2", { id: "post-2", title: "Advanced middleware patterns", authorId: "someone-else" }],
	["post-3", { id: "post-3", title: "Type-safe server actions", authorId: "allowed" }],
]);

export const validatedMiddlewareAction = authAction
	.metadata({ actionName: "validatedMiddlewareAction" })
	.inputSchema(schema)
	.useValidated(async ({ parsedInput, ctx, next }) => {
		// useValidated() runs AFTER input validation, so parsedInput is typed.
		const post = posts.get(parsedInput.postId);

		if (!post) {
			throw new Error(`Post "${parsedInput.postId}" not found`);
		}

		// Simulate ownership check: only "allowed" authorId can proceed.
		if (post.authorId !== "allowed") {
			throw new Error(`User ${ctx.userId.slice(0, 8)}... is not the author of "${post.title}"`);
		}

		// Pass the fetched post into context for the action to use.
		return next({ ctx: { post } });
	})
	.action(async ({ ctx }) => {
		return {
			message: `Access granted to "${ctx.post.title}"`,
			post: ctx.post,
			userId: ctx.userId,
			sessionId: ctx.sessionId,
		};
	});
