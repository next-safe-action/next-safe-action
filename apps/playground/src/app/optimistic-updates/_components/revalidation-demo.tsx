"use client";

import { useAction } from "next-safe-action/hooks";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { Button } from "@/components/ui/button";
import type { SourceCode } from "@/lib/shiki";
import { testRevalidation } from "../_actions/revalidation-action";

type Props = {
	source?: SourceCode;
};

export function RevalidationDemo({ source }: Props) {
	const { execute, result, status, reset, isTransitioning, isPending } = useAction(testRevalidation, {
		onExecute() {
			console.log("onExecute");
		},
		onSuccess() {
			console.log("onSuccess");
		},
		onError() {
			console.log("onError");
		},
		onSettled() {
			console.log("onSettled");
		},
	});

	return (
		<ExampleCard
			title="Revalidation + Callbacks"
			description="revalidatePath/revalidateTag with transition states."
			source={source}
		>
			<div className="flex flex-wrap gap-2">
				<Button onClick={() => execute({ kind: "revalidatePath" })}>Revalidate path</Button>
				<Button onClick={() => execute({ kind: "revalidateTag" })}>Revalidate tag</Button>
				<Button variant="outline" onClick={reset}>
					Reset
				</Button>
			</div>

			<div className="mt-4 flex gap-4 text-sm">
				<span>
					isTransitioning: <strong>{String(isTransitioning)}</strong>
				</span>
				<span>
					isPending: <strong>{String(isPending)}</strong>
				</span>
			</div>

			<ResultDisplay result={result} status={status} />
		</ExampleCard>
	);
}
