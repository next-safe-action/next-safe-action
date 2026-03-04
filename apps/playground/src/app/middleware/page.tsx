"use client";

import { useState } from "react";
import { ExampleCard } from "@/components/example-card";
import { PageHeader } from "@/components/page-header";
import { ResultDisplay } from "@/components/result-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authChainAction } from "./_actions/auth-chain-action";
import { errorHandlingAction } from "./_actions/error-handling-action";
import { loggingAction } from "./_actions/logging-action";
import { rateLimitAction } from "./_actions/rate-limit-action";
import { standaloneAction } from "./_actions/standalone-action";

export default function MiddlewarePage() {
	const [loggingResult, setLoggingResult] = useState<any>(undefined);
	const [authResult, setAuthResult] = useState<any>(undefined);
	const [standaloneResult, setStandaloneResult] = useState<any>(undefined);
	const [errorResult, setErrorResult] = useState<any>(undefined);
	const [rateLimitResult, setRateLimitResult] = useState<any>(undefined);
	const [rateLimitCount, setRateLimitCount] = useState(0);

	return (
		<div>
			<PageHeader
				title="Middleware"
				description="Logging, auth chains, standalone middleware, error handling, and rate limiting."
			/>
			<div className="space-y-6">
				<ExampleCard
					title="Logging Middleware"
					description="Built-in logging middleware on the base action client that tracks execution time and logs inputs/outputs."
				>
					<form
						className="space-y-4"
						onSubmit={async (e) => {
							e.preventDefault();
							const formData = new FormData(e.currentTarget);
							const res = await loggingAction({
								message: formData.get("message") as string,
							});
							setLoggingResult(res);
						}}
					>
						<div className="space-y-2">
							<Label htmlFor="logging-message">Message</Label>
							<Input id="logging-message" name="message" placeholder="Hello, middleware!" />
						</div>
						<Button type="submit">Execute with logging</Button>
					</form>
					<p className="text-muted-foreground mt-2 text-sm">Check the server console for timing logs.</p>
					<ResultDisplay result={loggingResult} />
				</ExampleCard>

				<ExampleCard
					title="Auth Chain"
					description="Two chained .use() middleware calls building context: first adds userId, second adds sessionId."
				>
					<form
						className="space-y-4"
						onSubmit={async (e) => {
							e.preventDefault();
							const formData = new FormData(e.currentTarget);
							const res = await authChainAction({
								fullName: formData.get("fullName") as string,
								age: formData.get("age") as string,
							});
							setAuthResult(res);
						}}
					>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="auth-fullName">Full Name</Label>
								<Input id="auth-fullName" name="fullName" placeholder="Jane Doe" />
							</div>
							<div className="space-y-2">
								<Label htmlFor="auth-age">Age</Label>
								<Input id="auth-age" name="age" placeholder="25" />
							</div>
						</div>
						<Button type="submit">Execute with auth</Button>
					</form>
					<ResultDisplay result={authResult} />
				</ExampleCard>

				<ExampleCard
					title="Standalone Middleware"
					description="Using createMiddleware().define() to create a reusable middleware function attached to a new client."
				>
					<form
						className="space-y-4"
						onSubmit={async (e) => {
							e.preventDefault();
							const formData = new FormData(e.currentTarget);
							const res = await standaloneAction({
								text: formData.get("text") as string,
							});
							setStandaloneResult(res);
						}}
					>
						<div className="space-y-2">
							<Label htmlFor="standalone-text">Text to process</Label>
							<Input id="standalone-text" name="text" placeholder="hello world" />
						</div>
						<Button type="submit">Execute standalone</Button>
					</form>
					<ResultDisplay result={standaloneResult} />
				</ExampleCard>

				<ExampleCard
					title="Error Handling Middleware"
					description="Middleware that catches DatabaseError and transforms it into a user-friendly ActionError."
				>
					<div className="flex gap-2">
						<Button
							onClick={async () => {
								const res = await errorHandlingAction({ simulateError: false });
								setErrorResult(res);
							}}
						>
							Success path
						</Button>
						<Button
							variant="destructive"
							onClick={async () => {
								const res = await errorHandlingAction({ simulateError: true });
								setErrorResult(res);
							}}
						>
							Simulate DB error
						</Button>
					</div>
					<ResultDisplay result={errorResult} />
				</ExampleCard>

				<ExampleCard
					title="Rate Limiting Middleware"
					description="In-memory rate limiter that allows max 5 calls per 10 seconds. Click rapidly to trigger the limit."
				>
					<div className="flex items-center gap-4">
						<Button
							onClick={async () => {
								setRateLimitCount((c) => c + 1);
								const res = await rateLimitAction({
									value: `click-${rateLimitCount + 1}`,
								});
								setRateLimitResult(res);
							}}
						>
							Execute (clicked {rateLimitCount}x)
						</Button>
						<Button
							variant="outline"
							onClick={() => {
								setRateLimitCount(0);
								setRateLimitResult(undefined);
							}}
						>
							Reset counter
						</Button>
					</div>
					<p className="text-muted-foreground mt-2 text-sm">
						Click more than 5 times in 10 seconds to see the rate limit error.
					</p>
					<ResultDisplay result={rateLimitResult} />
				</ExampleCard>
			</div>
		</div>
	);
}
