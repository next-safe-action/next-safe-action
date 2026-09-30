import { z } from "zod";

// A "use server" file can only export async functions, so values shared by an action and the router live here.

export const USERNAME_TAKEN = "Username is already taken";

export const todoBodySchema = z.object({
	title: z.string().min(1).optional(),
	done: z.boolean().optional(),
});
