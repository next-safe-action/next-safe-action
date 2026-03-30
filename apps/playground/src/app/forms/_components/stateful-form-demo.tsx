"use client";

import { useStateAction } from "next-safe-action/stateful-hooks";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SourceCode } from "@/lib/shiki";
import { statefulFormAction } from "../_actions/stateful-form-action";

type Props = {
	source?: SourceCode;
};

export function StatefulFormDemo({ source }: Props) {
	const { formAction, result, status, isPending, hasSucceeded, reset } = useStateAction(statefulFormAction, {
		initResult: { data: { newName: "jane" } },
		onSuccess: ({ data }) => {
			console.log("onSuccess:", data);
		},
		onError: ({ error }) => {
			console.error("onError:", error);
		},
	});

	return (
		<ExampleCard
			title="Stateful Form"
			description="stateAction with useStateAction hook, the previous result is available in the server function. Full callback and status support."
			source={source}
		>
			<form action={formAction} className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="stateful-name">Name</Label>
					<Input id="stateful-name" name="name" placeholder="Enter a name" />
				</div>
				<div className="flex gap-2">
					<Button type="submit" disabled={isPending}>
						{isPending ? "Submitting..." : "Submit"}
					</Button>
					{hasSucceeded && (
						<Button type="button" variant="outline" onClick={reset}>
							Reset
						</Button>
					)}
				</div>
			</form>
			<div className="mt-2 flex flex-wrap gap-2">
				<Badge variant={isPending ? "default" : "secondary"}>isPending: {String(isPending)}</Badge>
				<Badge variant="outline">status: {status}</Badge>
			</div>
			<ResultDisplay result={result} />
		</ExampleCard>
	);
}
