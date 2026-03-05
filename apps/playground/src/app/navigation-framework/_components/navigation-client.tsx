"use client";

import { useAction } from "next-safe-action/hooks";
import { useRef, useState } from "react";
import { CallbackTimeline } from "@/components/callback-timeline";
import type { TimelineEvent } from "@/components/callback-timeline";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { SourceCode } from "@/lib/shiki";
import { testNavigate } from "../_actions/navigation-action";

type Props = {
	source?: SourceCode;
};

export function NavigationClient({ source }: Props) {
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

	const { execute, result, status, reset } = useAction(testNavigate, {
		onExecute({ input }) {
			pushEvent("onExecute", { kind: input.kind });
		},
		onSuccess({ data }) {
			pushEvent("onSuccess", data);
		},
		onError({ error }) {
			pushEvent("onError", error);
		},
		onNavigation({ navigationKind }) {
			pushEvent("onNavigation", { navigationKind });
		},
		onSettled({ result }) {
			pushEvent("onSettled", result);
		},
	});

	return (
		<div className="space-y-6">
			<ExampleCard
				title="Navigation Actions"
				description="Buttons for each navigation function plus a success path."
				source={source}
			>
				<div className="flex flex-wrap gap-2">
					<Button onClick={() => execute({ kind: "redirect" })}>Redirect</Button>
					<Button onClick={() => execute({ kind: "notFound" })} variant="secondary">
						Not Found
					</Button>
					<Button onClick={() => execute({ kind: "forbidden" })} variant="secondary">
						Forbidden
					</Button>
					<Button onClick={() => execute({ kind: "unauthorized" })} variant="secondary">
						Unauthorized
					</Button>
					<Button onClick={() => execute({ kind: "happy-path" })} variant="outline">
						Happy path
					</Button>
					<Button onClick={reset} variant="ghost">
						Reset
					</Button>
				</div>

				<div className="mt-4 flex items-center gap-2">
					<span className="text-sm font-medium">Status:</span>
					<StatusBadge status={status} />
				</div>

				<ResultDisplay result={result} />
			</ExampleCard>

			<ExampleCard
				title="Callback Timeline"
				description="All callbacks including onNavigation fire with navigationKind when a navigation function is called."
			>
				<div className="mb-4">
					<Button variant="outline" size="sm" onClick={() => setEvents([])}>
						Clear timeline
					</Button>
				</div>
				<CallbackTimeline events={events} />
			</ExampleCard>
		</div>
	);
}
