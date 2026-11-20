"use client";

import { useState } from "react";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { Button } from "@/components/ui/button";
import type { SourceCode } from "@/lib/shiki";

export type RouteRequest = {
	method: "POST" | "PATCH";
	path: string;
	body?: unknown;
	headers?: Record<string, string>;
};

export type RouteExchange = {
	request: RouteRequest;
	status: number;
	body: unknown;
};

// Plain browser fetch, like any external client would do. Paths are relative to the catch-all route.
export async function callRoute(request: RouteRequest): Promise<RouteExchange> {
	const response = await fetch("/api/routes" + request.path, {
		method: request.method,
		headers: { "content-type": "application/json", ...request.headers },
		body: request.body === undefined ? undefined : JSON.stringify(request.body),
	});
	return { request, status: response.status, body: await response.json() };
}

export function HttpExchange({ exchange, testId }: { exchange?: RouteExchange; testId?: string }) {
	return (
		<div className="grid gap-4 md:grid-cols-2" aria-live="polite" data-testid={testId}>
			<ResultDisplay label="Request:" result={exchange?.request} />
			<ResultDisplay label={exchange ? `Response: HTTP ${exchange.status}` : "Response:"} result={exchange?.body} />
		</div>
	);
}

type Props = {
	title: string;
	description: string;
	source: SourceCode;
	testId: string;
	requests: { label: string; request: RouteRequest }[];
};

// Sends one of a few prepared requests and shows the raw HTTP status and JSON body.
export function HttpDemo({ title, description, source, testId, requests }: Props) {
	const [exchange, setExchange] = useState<RouteExchange>();

	return (
		<ExampleCard title={title} description={description} source={source}>
			<div className="flex flex-wrap gap-2">
				{requests.map(({ label, request }) => (
					<Button key={label} variant="outline" onClick={async () => setExchange(await callRoute(request))}>
						{label}
					</Button>
				))}
			</div>
			<HttpExchange exchange={exchange} testId={testId} />
		</ExampleCard>
	);
}
