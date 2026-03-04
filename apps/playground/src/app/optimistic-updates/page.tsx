import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { readAndHighlightFile } from "@/lib/shiki";
import { getTodos } from "./_actions/add-todo-action";
import { AddTodoForm } from "./_components/add-todo-form";
import { RevalidationDemo } from "./_components/revalidation-demo";
import { getLiveSnapshot, getTaggedSnapshot, REVALIDATION_TAG } from "./_store/revalidation-store";

async function RevalidationSnapshots() {
	const [liveSnapshot, taggedSnapshot] = await Promise.all([getLiveSnapshot(), getTaggedSnapshot()]);

	return (
		<div className="mt-4 grid gap-4 sm:grid-cols-2">
			<div>
				<h4 className="text-sm font-medium">Live server snapshot</h4>
				<pre className="bg-muted mt-1 rounded-md border p-3 font-mono text-xs">
					{JSON.stringify(liveSnapshot, null, 2)}
				</pre>
			</div>
			<div>
				<h4 className="text-sm font-medium">
					Tagged snapshot (<code>{REVALIDATION_TAG}</code>)
				</h4>
				<pre className="bg-muted mt-1 rounded-md border p-3 font-mono text-xs">
					{JSON.stringify(taggedSnapshot, null, 2)}
				</pre>
			</div>
		</div>
	);
}

export default async function OptimisticUpdatesPage() {
	await connection();

	const [todos, addTodoSource, revalidationSource] = await Promise.all([
		getTodos(),
		readAndHighlightFile("optimistic-updates/_actions/add-todo-action.ts"),
		readAndHighlightFile("optimistic-updates/_actions/revalidation-action.ts"),
	]);

	return (
		<div>
			<PageHeader
				title="Optimistic Updates"
				description="useOptimisticAction with instant UI updates and revalidation callbacks."
			/>
			<div className="space-y-6">
				<AddTodoForm todos={todos} source={addTodoSource} />
				<div>
					<RevalidationDemo source={revalidationSource} />
					<Suspense fallback={<p className="text-muted-foreground mt-4 text-sm">Loading snapshots...</p>}>
						<RevalidationSnapshots />
					</Suspense>
				</div>
			</div>
		</div>
	);
}
