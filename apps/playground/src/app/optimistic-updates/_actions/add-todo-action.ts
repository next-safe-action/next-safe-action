"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, action } from "@/lib/safe-action";

const schema = z.object({
	id: z.uuid(),
	body: z.string().min(1),
	completed: z.boolean(),
});

export type Todo = z.infer<typeof schema>;

let todos: Todo[] = [];
export const getTodos = async () => todos;

export const addTodo = action
	.metadata({ actionName: "addTodo" })
	.inputSchema(schema)
	.action(async ({ parsedInput }) => {
		await new Promise((res) => setTimeout(res, 500));

		if (Math.random() > 0.5) {
			throw new ActionError("Could not add todo right now, please try again later.");
		}

		todos.push(parsedInput);
		revalidatePath("/optimistic-updates");

		return {
			newTodo: parsedInput,
		};
	});
