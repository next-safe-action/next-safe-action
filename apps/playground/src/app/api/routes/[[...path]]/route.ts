import { createRouteHandlers } from "next-safe-action/routes";
import { router } from "@/app/routes/_lib/router";

export const { POST, PUT, PATCH, DELETE } = createRouteHandlers(router, {
	// Receives the original error behind every sanitized 500 response.
	onError: (error) => console.error("Route handler error:", error),
});
