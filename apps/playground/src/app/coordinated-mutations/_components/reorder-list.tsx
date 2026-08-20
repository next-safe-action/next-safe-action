"use client";

import { useOptimisticStateAction } from "next-safe-action/hooks";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { Button } from "@/components/ui/button";
import type { SourceCode } from "@/lib/shiki";
import { moveItem } from "../_actions/reorder-action";
import type { Item, Move } from "../_lib/reorder";
import { reorder } from "../_lib/reorder";

type Props = {
	items: Item[];
	source?: SourceCode;
};

export function ReorderList({ items, source }: Props) {
	const { execute, optimisticState, status, result, isPending, reset } = useOptimisticStateAction(moveItem, {
		currentState: items,
		// The same reducer the server runs.
		updateFn: reorder,
		onSuccess({ input }) {
			console.log("onSuccess for dispatch:", input);
		},
		onError({ error, input }) {
			console.log("onError for dispatch:", input, error);
		},
	});

	return (
		<ExampleCard
			title="Queued Reordering"
			description="useOptimisticStateAction: each move renders instantly, saves run one after another, and a rejected move rolls back to the last confirmed order."
			source={source}
		>
			<ul className="space-y-2">
				{optimisticState.map((item, index) => (
					<li key={item.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
						<span>{item.label}</span>
						<span className="flex gap-1">
							<Button
								size="sm"
								variant="outline"
								disabled={index === 0}
								onClick={() => execute({ id: item.id, direction: "up" })}
							>
								Up
							</Button>
							<Button
								size="sm"
								variant="outline"
								disabled={index === optimisticState.length - 1}
								onClick={() => execute({ id: item.id, direction: "down" })}
							>
								Down
							</Button>
						</span>
					</li>
				))}
			</ul>

			<div className="mt-4 flex gap-2">
				<Button
					variant="destructive"
					onClick={() =>
						// Fails input validation, so the server never mutates: the optimistic move rolls
						// back and the next queued dispatch still receives the last confirmed order.
						execute({ id: "a", direction: "sideways" } as unknown as Move)
					}
				>
					Move that fails validation
				</Button>
				<Button variant="outline" onClick={reset}>
					Reset
				</Button>
			</div>

			<p className="text-muted-foreground mt-4 text-sm">
				Each save takes 1.2s. Click several moves quickly: every one shows immediately, and the writes are serialized
				rather than raced. {isPending ? "Saving..." : "Idle."}
			</p>

			<ResultDisplay result={result} status={status} label="Last settled result:" />
		</ExampleCard>
	);
}
