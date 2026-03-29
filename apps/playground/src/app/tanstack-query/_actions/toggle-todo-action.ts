"use server";

import { ActionError, action } from "@/lib/safe-action";
import { toggleTodoSchema } from "../_validation/schemas";

export type Todo = {
	id: string;
	title: string;
	done: boolean;
};

let todos: Todo[] = [
	{ id: "1", title: "Buy groceries", done: false },
	{ id: "2", title: "Walk the dog", done: true },
	{ id: "3", title: "Write documentation", done: false },
];

export const getTodos = async () => todos;

export const toggleTodo = action
	.metadata({ actionName: "toggleTodo" })
	.inputSchema(toggleTodoSchema)
	.action(async ({ parsedInput: { id, done } }) => {
		await new Promise((res) => setTimeout(res, 500));

		if (Math.random() > 0.7) {
			throw new ActionError("Random server error, please try again.");
		}

		const todo = todos.find((t) => t.id === id);

		if (!todo) {
			throw new ActionError("Todo not found.");
		}

		todo.done = done;

		return { todo };
	});
