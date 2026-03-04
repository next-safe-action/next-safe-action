"use client";

import { useAction } from "next-safe-action/hooks";
import { useRef, useState } from "react";
import { CallbackTimeline } from "@/components/callback-timeline";
import type { TimelineEvent } from "@/components/callback-timeline";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { Button } from "@/components/ui/button";
import type { SourceCode } from "@/lib/shiki";
import { testRevalidation } from "../_actions/revalidation-action";

type Props = {
	source?: SourceCode;
};

export function RevalidationDemo({ source }: Props) {
	const [events, setEvents] = useState<TimelineEvent[]>([]);
	const idRef = useRef(0);

	const pushEvent = (callback: string, data?: unknown) => {
		const event: TimelineEvent = {
			id: String(++idRef.current),
			callback,
			timestamp: Date.now(),
			data,
		};

		setEvents((prev) => [...prev, event]);
	};

	const { execute, result, status, reset, isTransitioning, isPending } = useAction(testRevalidation, {
		onExecute() {
			pushEvent("onExecute");
		},
		onSuccess() {
			pushEvent("onSuccess");
		},
		onError() {
			pushEvent("onError");
		},
		onSettled() {
			pushEvent("onSettled");
		},
	});

	return (
		<ExampleCard
			title="Revalidation + Callbacks"
			description="revalidatePath/revalidateTag with callback timeline showing transition states."
			source={source}
		>
			<div className="flex flex-wrap gap-2">
				<Button onClick={() => execute({ kind: "revalidatePath" })}>Revalidate path</Button>
				<Button onClick={() => execute({ kind: "revalidateTag" })}>Revalidate tag</Button>
				<Button variant="outline" onClick={reset}>
					Reset
				</Button>
				<Button variant="outline" onClick={() => setEvents([])}>
					Clear log
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

			<div className="mt-4">
				<h4 className="mb-2 text-sm font-medium">Callback Timeline</h4>
				<CallbackTimeline events={events} />
			</div>
		</ExampleCard>
	);
}
