"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { Button } from "@/components/ui/button";
import type { SourceCode } from "@/lib/shiki";
import { routeCounter } from "../_actions/counter-action";
import { callRoute, HttpExchange } from "./http-demo";
import type { RouteExchange, RouteRequest } from "./http-demo";

export function CounterDemo({ source }: { source: SourceCode }) {
	const { execute, result, isPending } = useAction(routeCounter);
	const [exchange, setExchange] = useState<RouteExchange>();
	const send = async (request: RouteRequest) => setExchange(await callRoute(request));

	return (
		<ExampleCard
			title="One action, two transports"
			description="useAction calls the action as a Server Action. fetch calls POST /api/routes/counter. Both update the same cookie counter, and an invalid body returns 400 with the usual validation errors."
			source={source}
		>
			<div className="flex flex-wrap gap-2">
				<Button disabled={isPending} onClick={() => execute({ amount: 1 })}>
					Increment route counter
				</Button>
				<Button variant="outline" onClick={() => send({ method: "POST", path: "/counter", body: { amount: 1 } })}>
					POST /counter
				</Button>
				<Button variant="outline" onClick={() => send({ method: "POST", path: "/counter", body: { amount: "one" } })}>
					POST /counter (invalid body)
				</Button>
			</div>
			<div data-testid="counter-hook-result">
				<ResultDisplay label="useAction result:" result={result} />
			</div>
			<HttpExchange exchange={exchange} testId="counter-http-result" />
		</ExampleCard>
	);
}
