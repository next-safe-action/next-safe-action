"use client";

import { ScrollArea } from "@/components/ui/scroll-area";

export type TimelineEvent = {
	id: string;
	callback: string;
	timestamp: number;
	data?: unknown;
};

type Props = {
	events: TimelineEvent[];
};

export function CallbackTimeline({ events }: Props) {
	if (events.length === 0) {
		return <p className="text-muted-foreground text-sm">No callback events yet. Execute an action to see them here.</p>;
	}

	const startTime = events[0]?.timestamp ?? 0;
	const orderedEvents = events.toReversed();

	return (
		<ScrollArea className="h-64">
			<div className="space-y-2">
				{orderedEvents.map((event) => (
					<div key={event.id} className="flex gap-3 rounded-md border p-2 text-sm">
						<span className="text-muted-foreground shrink-0 font-mono text-xs">+{event.timestamp - startTime}ms</span>
						<div className="min-w-0 flex-1">
							<span className="font-medium">{event.callback}</span>
							{event.data !== undefined ? (
								<pre className="text-muted-foreground mt-1 truncate font-mono text-xs">
									{JSON.stringify(event.data)}
								</pre>
							) : null}
						</div>
					</div>
				))}
			</div>
		</ScrollArea>
	);
}
