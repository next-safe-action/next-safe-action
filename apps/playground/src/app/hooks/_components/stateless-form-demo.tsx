"use client";

import { useAction } from "next-safe-action/hooks";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SourceCode } from "@/lib/shiki";
import { statelessFormAction } from "../_actions/stateless-form-action";

type Props = {
	source?: SourceCode;
};

export function StatelessFormDemo({ source }: Props) {
	const { execute, result, status } = useAction(statelessFormAction);

	return (
		<ExampleCard
			title="Stateless Form"
			description="Form using useAction + execute to submit FormData directly."
			source={source}
		>
			<form action={execute} className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="stateless-name">Name</Label>
					<Input id="stateless-name" name="name" placeholder="Enter your name" />
				</div>
				<Button type="submit">Submit</Button>
			</form>
			<ResultDisplay result={result} status={status} />
		</ExampleCard>
	);
}
