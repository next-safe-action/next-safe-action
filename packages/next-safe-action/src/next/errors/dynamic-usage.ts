// Comes from https://github.com/vercel/next.js/blob/canary/packages/next/src/export/helpers/is-dynamic-usage-error.ts

import { isBailoutToCSRError } from "./bailout-to-csr";
import { isNextRouterError } from "./router";

const DYNAMIC_ERROR_CODE = "DYNAMIC_SERVER_USAGE";

class DynamicServerError extends Error {
	digest: typeof DYNAMIC_ERROR_CODE = DYNAMIC_ERROR_CODE;

	constructor(public readonly description: string) {
		super(`Dynamic server usage: ${description}`);
	}
}

function isDynamicServerError(err: unknown): err is DynamicServerError {
	if (typeof err !== "object" || err === null || !("digest" in err) || typeof err.digest !== "string") {
		return false;
	}

	return err.digest === DYNAMIC_ERROR_CODE;
}

function isDynamicPostponeReason(reason: string) {
	return (
		reason.includes("needs to bail out of prerendering at this point because it used") &&
		reason.includes("Learn more: https://nextjs.org/docs/messages/ppr-caught-error")
	);
}

function isDynamicPostpone(err: unknown) {
	if (
		typeof err === "object" &&
		err !== null &&
		// oxlint-disable-next-line
		typeof (err as any).message === "string"
	) {
		// oxlint-disable-next-line
		return isDynamicPostponeReason((err as any).message);
	}
	return false;
}

export const isDynamicUsageError = (err: unknown) =>
	isDynamicServerError(err) || isBailoutToCSRError(err) || isNextRouterError(err) || isDynamicPostpone(err);
