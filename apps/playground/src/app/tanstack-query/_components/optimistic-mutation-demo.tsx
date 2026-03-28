"use client";

import { mutationOptions } from "@next-safe-action/adapter-tanstack-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheckIcon, CircleIcon } from "lucide-react";
import { ExampleCard } from "@/components/example-card";
import type { SourceCode } from "@/lib/shiki";
import type { Todo } from "../_actions/toggle-todo-action";
import { toggleTodo } from "../_actions/toggle-todo-action";
import { MutationStatusBadge } from "./mutation-status-badge";

type Props = {
	initialTodos: Todo[];
	source?: SourceCode;
};

export function OptimisticMutationDemo({ initialTodos, source }: Props) {
	const queryClient = useQueryClient();

	const { data: todos } = useQuery({
		queryKey: ["todos"],
		initialData: initialTodos,
		staleTime: Infinity,
	});

	const mutation = useMutation(
		mutationOptions(toggleTodo, {
			onMutate: async (input) => {
				await queryClient.cancelQueries({ queryKey: ["todos"] });
				const previous = queryClient.getQueryData<Todo[]>(["todos"]);

				queryClient.setQueryData<Todo[]>(["todos"], (old) =>
					old?.map((t) => (t.id === input.id ? { ...t, done: input.done } : t))
				);

				return { previous };
			},
			onError: (_error, _input, context) => {
				if (context?.previous) {
					queryClient.setQueryData(["todos"], context.previous);
				}
			},
			onSettled: () => {
				void queryClient.invalidateQueries({ queryKey: ["todos"] });
			},
		})
	);

	return (
		<ExampleCard
			title="Optimistic updates"
			description="Todos toggle instantly via onMutate — reverts on server error (30% random failure rate)."
			source={source}
		>
			<div className="space-y-2">
				{todos.map((todo) => (
					<button
						key={todo.id}
						type="button"
						onClick={() => mutation.mutate({ id: todo.id, done: !todo.done })}
						className="hover:bg-muted flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors"
					>
						{todo.done ? (
							<CircleCheckIcon className="text-primary size-5 shrink-0" />
						) : (
							<CircleIcon className="text-muted-foreground size-5 shrink-0" />
						)}
						<span className={todo.done ? "text-muted-foreground line-through" : ""}>{todo.title}</span>
					</button>
				))}
			</div>

			<div className="mt-3 flex items-center gap-2">
				<span className="text-sm font-medium">Mutation status:</span>
				<MutationStatusBadge status={mutation.status} />
			</div>

			{mutation.isError ? (
				<div className="mt-3">
					<span className="text-destructive text-sm font-medium">Error:</span>
					<pre className="bg-muted mt-1 max-h-40 overflow-auto rounded-md border p-3 font-mono text-sm">
						{mutation.error.message}
					</pre>
				</div>
			) : null}

			<p className="text-muted-foreground mt-4 text-xs">
				Note: In production, you would pair this with a Route Handler (GET endpoint) so{" "}
				<code className="bg-muted rounded px-1 py-0.5 text-xs">invalidateQueries</code> can refetch fresh data from the
				server.
			</p>
		</ExampleCard>
	);
}
