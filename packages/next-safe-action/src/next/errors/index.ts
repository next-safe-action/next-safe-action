import type { NavigationKind } from "../../index.types";
import { isBailoutToCSRError } from "./bailout-to-csr";
import { isDynamicUsageError } from "./dynamic-usage";
import { getAccessFallbackHTTPStatus, isHTTPAccessFallbackError } from "./http-access-fallback";
import { isPostpone } from "./postpone";
import { isRedirectError } from "./redirect";
import { isNextRouterError } from "./router";

export class FrameworkErrorHandler {
	#frameworkError: Error | undefined;

	static isNavigationError(error: unknown): error is Error {
		return isNextRouterError(error) || isBailoutToCSRError(error) || isDynamicUsageError(error) || isPostpone(error);
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
