import { PageHeader } from "@/components/page-header";
import { readAndHighlightFile } from "@/lib/shiki";
import { MiddlewareClient } from "./_components/middleware-client";

export default async function MiddlewarePage() {
	const [loggingAction, authChainAction, errorHandlingAction, rateLimitAction, validatedMiddlewareAction] =
		await Promise.all([
			readAndHighlightFile("middleware/_actions/logging-action.ts"),
			readAndHighlightFile("middleware/_actions/auth-chain-action.ts"),
			readAndHighlightFile("middleware/_actions/error-handling-action.ts"),
			readAndHighlightFile("middleware/_actions/rate-limit-action.ts"),
			readAndHighlightFile("middleware/_actions/validated-middleware-action.ts"),
		]);

	return (
		<div>
			<PageHeader title="Middleware" description="Logging, auth chains, error handling, and rate limiting." />
			<MiddlewareClient
				sources={{
					loggingAction,
					authChainAction,
					errorHandlingAction,
					rateLimitAction,
					validatedMiddlewareAction,
				}}
			/>
		</div>
	);
}
