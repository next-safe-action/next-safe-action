"use client";

import { useAction } from "next-safe-action/hooks";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { Button } from "@/components/ui/button";
import { routeCounter } from "../../api/routes/actions";

export function RouteActionDemo() {
	const { execute, result, isPending } = useAction(routeCounter);
	return (
		<ExampleCard
			title="Route adapter"
			description="Use this action through a hook or POST /api/routes/counter with a JSON amount. Both paths use the same cookie counter."
		>
			<Button disabled={isPending} onClick={() => execute({ amount: 1 })}>
				Increment route counter
			</Button>
			<div aria-live="polite">
				<ResultDisplay result={result} />
			</div>
		</ExampleCard>
	);
}
