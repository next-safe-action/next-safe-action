"use client";

import { useStateAction } from "next-safe-action/hooks";
import { useState } from "react";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { Button } from "@/components/ui/button";
import type { SourceCode } from "@/lib/shiki";
import { addToTotal } from "../_actions/running-total-action";
import { callRoute, HttpExchange } from "./http-demo";
import type { RouteExchange } from "./http-demo";

export function RunningTotalDemo({ source }: { source: SourceCode }) {
	const { execute, result, isPending } = useStateAction(addToTotal);
	const [exchange, setExchange] = useState<RouteExchange>();

	return (
		<ExampleCard
			title="Stateful action"
			description="useStateAction keeps the previous result in React. Over HTTP, the client sends it back in a { input, prevResult } envelope, validated by stateSchema. The fetch button reuses the last HTTP response as prevResult."
			source={source}
		>
			<div className="flex flex-wrap gap-2">
				<Button disabled={isPending} onClick={() => execute({ amount: 5 })}>
					Add 5 (useStateAction)
				</Button>
				<Button
					variant="outline"
					onClick={async () =>
						setExchange(
							await callRoute({
								method: "POST",
								path: "/total",
								body: { input: { amount: 5 }, prevResult: exchange?.body },
							})
						)
					}
				>
					POST /total
				</Button>
				<Button variant="ghost" onClick={() => setExchange(undefined)}>
					Clear HTTP state
				</Button>
			</div>
			<ResultDisplay label="useStateAction result:" result={result} />
			<HttpExchange exchange={exchange} testId="total-http-result" />
		</ExampleCard>
	);
}
