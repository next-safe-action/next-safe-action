"use client";

import { useActionState } from "react";
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
	const [state, formAction, isPending] = useActionState(statefulFormAction, {
		data: { newName: "jane" },
	});

	return (
		<ExampleCard
			title="Stateful Form"
			description="stateAction with React useActionState — the previous result is available in the server function."
			source={source}
		>
			<form action={formAction} className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="stateful-name">Name</Label>
					<Input id="stateful-name" name="name" placeholder="Enter a name" />
				</div>
				<Button type="submit" disabled={isPending}>
					{isPending ? "Submitting..." : "Submit"}
				</Button>
			</form>
			<div className="mt-2">
				<Badge variant={isPending ? "default" : "secondary"}>isPending: {String(isPending)}</Badge>
			</div>
			<ResultDisplay result={state} />
		</ExampleCard>
	);
}
