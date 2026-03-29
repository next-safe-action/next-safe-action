import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { readAndHighlightFile } from "@/lib/shiki";
import { getTodos } from "./_actions/toggle-todo-action";
import { BasicMutationDemo } from "./_components/basic-mutation-demo";
import { MutationWithCallbacksDemo } from "./_components/mutation-with-callbacks-demo";
import { OptimisticMutationDemo } from "./_components/optimistic-mutation-demo";

export default async function TanStackQueryPage() {
	await connection();

	const [todos, createUserSource, toggleTodoSource] = await Promise.all([
		getTodos(),
		readAndHighlightFile("tanstack-query/_actions/create-user-action.ts"),
		readAndHighlightFile("tanstack-query/_actions/toggle-todo-action.ts"),
	]);

	return (
		<div>
			<PageHeader
				title="TanStack Query"
				description="mutationOptions() adapter for @tanstack/react-query, type-safe mutations with error bridging."
			/>
			<div className="space-y-6">
				<BasicMutationDemo source={createUserSource} />
				<MutationWithCallbacksDemo source={createUserSource} />
				<OptimisticMutationDemo initialTodos={todos} source={toggleTodoSource} />
			</div>
		</div>
	);
}
