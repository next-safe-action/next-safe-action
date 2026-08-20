import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { readAndHighlightFile } from "@/lib/shiki";
import { getItems } from "./_actions/reorder-action";
import { ReorderList } from "./_components/reorder-list";

export default async function CoordinatedMutationsPage() {
	await connection();

	const [items, source] = await Promise.all([
		getItems(),
		readAndHighlightFile("coordinated-mutations/_actions/reorder-action.ts"),
	]);

	return (
		<div>
			<PageHeader
				title="Coordinating Mutations"
				description="useOptimisticStateAction queues overlapping writes and folds every in-flight change over the confirmed state."
			/>
			<ReorderList items={items} source={source} />
		</div>
	);
}
