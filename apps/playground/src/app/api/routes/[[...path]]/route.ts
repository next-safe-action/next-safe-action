import { createRouteHandlers } from "@next-safe-action/adapter-routes";
import { routeActions } from "@/app/routes/_lib/route-actions";

export const { POST, PUT, PATCH, DELETE, OPTIONS } = createRouteHandlers({
	actions: routeActions,
	// Receives the original error behind every sanitized 500 response.
	onError: (error) => console.error("Route handler error:", error),
});
