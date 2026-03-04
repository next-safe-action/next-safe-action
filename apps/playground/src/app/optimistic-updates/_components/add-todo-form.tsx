"use client";

import { useOptimisticAction } from "next-safe-action/hooks";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SourceCode } from "@/lib/shiki";
import type { Todo } from "../_actions/add-todo-action";
import { addTodo } from "../_actions/add-todo-action";

type Props = {
	todos: Todo[];
	source?: SourceCode;
};

export function AddTodoForm({ todos, source }: Props) {
	const { execute, status, reset, optimisticState } = useOptimisticAction(addTodo, {
		currentState: { todos },
		updateFn: (state, newTodo) => ({
			todos: [...state.todos, newTodo],
		}),
		onSuccess(args) {
			console.log("onSuccess:", args);
		},
		onError(args) {
			console.log("onError:", args);
		},
	});

	return (
		<ExampleCard
			title="Optimistic Todo List"
			description="useOptimisticAction with currentState/updateFn — items appear instantly before server confirms."
			source={source}
		>
			<form
				className="space-y-4"
				onSubmit={(e) => {
					e.preventDefault();
					const formData = new FormData(e.currentTarget);
					const body = formData.get("body") as string;
					execute({ id: crypto.randomUUID(), body, completed: false });
					e.currentTarget.reset();
				}}
			>
				<div className="space-y-2">
					<Label htmlFor="todo-body">Todo</Label>
					<Input id="todo-body" name="body" placeholder="What needs to be done?" />
				</div>
				<div className="flex gap-2">
					<Button type="submit">Add todo</Button>
					<Button type="button" variant="outline" onClick={reset}>
						Reset
					</Button>
				</div>
			</form>

			{optimisticState.todos.length > 0 ? (
				<ul className="mt-4 space-y-2">
					{optimisticState.todos.map((todo) => (
						<li key={todo.id} className="rounded-md border p-2 text-sm">
							{todo.body}
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted-foreground mt-4 text-sm">No todos yet.</p>
			)}

			<ResultDisplay result={optimisticState} status={status} label="Optimistic state:" />
		</ExampleCard>
	);
}
