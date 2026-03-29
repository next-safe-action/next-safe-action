import { z } from "zod";

export const createUserSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	email: z.string().email("Invalid email address"),
});

export const toggleTodoSchema = z.object({
	id: z.string().min(1),
	done: z.boolean(),
});
