"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { Button } from "@/components/ui/button";
import type { SourceCode } from "@/lib/shiki";
import { stateUpdateAction } from "../_actions/state-update-action";

type Props = {
	source?: SourceCode;
};

export function StateUpdateDemo({ source }: Props) {
	const [localMessage, setLocalMessage] = useState<string>("(none)");

	const { execute, result, status } = useAction(stateUpdateAction, {
		onSuccess({ data }) {
			if (data) {
				setLocalMessage(data.message);
			}
		},
	});

	return (
		<ExampleCard
			title="State Update via onSuccess"
			description="Local state updated through the onSuccess callback when the action completes."
			source={source}
		>
			<div className="space-y-4">
				<p className="text-sm">
					Local state: <span className="font-mono font-medium">{localMessage}</span>
				</p>
				<Button onClick={() => execute()}>Execute action</Button>
			</div>
			<ResultDisplay result={result} status={status} />
		</ExampleCard>
	);
}
