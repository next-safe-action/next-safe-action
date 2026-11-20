import type { NavigationKind } from "../../index.types";
import { getAccessFallbackHTTPStatus, isHTTPAccessFallbackError } from "./http-access-fallback";
import { isDynamicPostpone, isPostpone } from "./postpone";
import { isRedirectError } from "./redirect";

/**
 * Digests of framework control-flow errors that carry no extra data. Each one mirrors a check in
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/client/components/unstable-rethrow.server.ts
 */
const FRAMEWORK_SIGNAL_DIGESTS = new Set([
	// shared/lib/lazy-dynamic/bailout-to-csr.ts (`isBailoutToCSRError`)
	"BAILOUT_TO_CLIENT_SIDE_RENDERING",
	// client/components/hooks-server-context.ts (`isDynamicServerError`)
	"DYNAMIC_SERVER_USAGE",
	// server/dynamic-rendering-utils.ts (`isHangingPromiseRejectionError`), Next.js >= 15.2 with
	// `cacheComponents`/`dynamicIO`: a request-data promise rejected when a prerender aborts.
	"HANGING_PROMISE_REJECTION",
	// server/app-render/dynamic-rendering.ts (`isPrerenderInterruptedError`), Next.js >= 16 with
	// `cacheComponents`: thrown synchronously, e.g. by `revalidatePath()` or `draftMode()` during a prerender.
	"NEXT_PRERENDER_INTERRUPTED",
]);

function hasFrameworkSignalDigest(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"digest" in error &&
		typeof error.digest === "string" &&
		FRAMEWORK_SIGNAL_DIGESTS.has(error.digest)
	);
}

export class FrameworkErrorHandler {
	#frameworkError: Error | undefined;

	/** Same set of errors that Next.js `unstable_rethrow()` re-throws (without walking `error.cause`). */
	static isNavigationError(error: unknown): error is Error {
		return (
			isRedirectError(error) ||
			isHTTPAccessFallbackError(error) ||
			hasFrameworkSignalDigest(error) ||
			isDynamicPostpone(error) ||
			isPostpone(error)
		);
	}

	static getNavigationKind(error: Error): NavigationKind {
		if (isRedirectError(error)) {
			return "redirect";
		}

		if (isHTTPAccessFallbackError(error)) {
			const status = getAccessFallbackHTTPStatus(error);
			if (status === 404) return "notFound";
			if (status === 403) return "forbidden";
			if (status === 401) return "unauthorized";
		}

		return "other";
	}

	// Used in action builder.
	handleError(e: unknown) {
		if (FrameworkErrorHandler.isNavigationError(e)) {
			this.#frameworkError = e;
			return;
		}

		// If it's not a framework error, rethrow it, so it gets returned as a server error.
		throw e;
	}

	get error() {
		return this.#frameworkError;
	}
}

/** Inspect only framework control-flow signals, without handling other errors. */
export function inspectFrameworkError(
	error: unknown
): { kind: "redirect"; destination: string } | { kind: "access"; status: number } | { kind: "other" } | undefined {
	if (isRedirectError(error)) return { kind: "redirect", destination: error.digest.split(";").slice(2, -2).join(";") };
	if (isHTTPAccessFallbackError(error)) return { kind: "access", status: getAccessFallbackHTTPStatus(error) };
	if (FrameworkErrorHandler.isNavigationError(error)) return { kind: "other" };
	return undefined;
}
