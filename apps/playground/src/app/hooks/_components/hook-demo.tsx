"use client";

import { useAction } from "next-safe-action/hooks";
import { useRef, useState } from "react";
import { CallbackTimeline } from "@/components/callback-timeline";
import type { TimelineEvent } from "@/components/callback-timeline";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteUser } from "../_actions/delete-user-action";

export function HookDemo() {
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

	const {
		execute: _execute,
		executeAsync,
		result,
		status,
		reset,
		input,
		isIdle,
		isExecuting,
		isTransitioning,
		isPending,
		hasSucceeded,
		hasErrored,
	} = useAction(deleteUser, {
		onExecute({ input }) {
			pushEvent("onExecute", { input });
		},
		onSuccess({ data, input }) {
			pushEvent("onSuccess", { data, input });
		},
		onError({ error, input }) {
			pushEvent("onError", { error, input });
		},
		onSettled({ result, input }) {
			pushEvent("onSettled", { result, input });
		},
	});

	return (
		<>
			<ExampleCard
				title="useAction Full Demo"
				description="All return properties: execute, executeAsync, result, status, reset, input, and all status flags."
			>
				<form
					className="space-y-4"
					onSubmit={async (e) => {
						e.preventDefault();
						const formData = new FormData(e.currentTarget);
						const userId = formData.get("userId") as string;
						const r = await executeAsync({ userId });
						console.log("executeAsync result:", r);
					}}
				>
					<div className="space-y-2">
						<Label htmlFor="hook-userId">User ID</Label>
						<Input id="hook-userId" name="userId" placeholder="user123" />
					</div>
					<div className="flex gap-2">
						<Button type="submit">Delete user (executeAsync)</Button>
						<Button type="button" variant="outline" onClick={reset}>
							Reset
						</Button>
					</div>
				</form>

				<div className="mt-4 space-y-3">
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium">Status:</span>
						<StatusBadge status={status} />
					</div>
					<div className="flex flex-wrap gap-2">
						<Badge variant={isIdle ? "default" : "outline"}>isIdle: {String(isIdle)}</Badge>
						<Badge variant={isExecuting ? "default" : "outline"}>isExecuting: {String(isExecuting)}</Badge>
						<Badge variant={isTransitioning ? "default" : "outline"}>isTransitioning: {String(isTransitioning)}</Badge>
						<Badge variant={isPending ? "default" : "outline"}>isPending: {String(isPending)}</Badge>
						<Badge variant={hasSucceeded ? "default" : "outline"}>hasSucceeded: {String(hasSucceeded)}</Badge>
						<Badge variant={hasErrored ? "destructive" : "outline"}>hasErrored: {String(hasErrored)}</Badge>
					</div>
					{input ? (
						<div>
							<span className="text-sm font-medium">Last input:</span>
							<pre className="bg-muted mt-1 rounded-md border p-2 font-mono text-sm">
								{JSON.stringify(input, null, 2)}
							</pre>
						</div>
					) : null}
				</div>

				<ResultDisplay result={result} />
			</ExampleCard>

			<ExampleCard
				title="Callback Inspector"
				description="All callbacks (onExecute, onSuccess, onError, onSettled) logged with timestamps. Use the form above to trigger events."
			>
				<div className="mb-4 flex gap-2">
					<Button variant="outline" size="sm" onClick={() => setEvents([])}>
						Clear timeline
					</Button>
				</div>
				<CallbackTimeline events={events} />
			</ExampleCard>
		</>
	);
}
