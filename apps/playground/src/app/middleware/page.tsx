import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { readAndHighlightFile } from "@/lib/shiki";
import { MiddlewareClient } from "./_components/middleware-client";

export default async function MiddlewarePage() {
	await connection();
	const [loggingAction, authChainAction, standaloneAction, errorHandlingAction, rateLimitAction] = await Promise.all([
		readAndHighlightFile("middleware/_actions/logging-action.ts"),
		readAndHighlightFile("middleware/_actions/auth-chain-action.ts"),
		readAndHighlightFile("middleware/_actions/standalone-action.ts"),
		readAndHighlightFile("middleware/_actions/error-handling-action.ts"),
		readAndHighlightFile("middleware/_actions/rate-limit-action.ts"),
	]);

	return (
		<div>
			<PageHeader
				title="Middleware"
				description="Logging, auth chains, standalone middleware, error handling, and rate limiting."
			/>
			<MiddlewareClient
				sources={{
					loggingAction,
					authChainAction,
					standaloneAction,
					errorHandlingAction,
					rateLimitAction,
				}}
			/>
		</div>
	);
}
