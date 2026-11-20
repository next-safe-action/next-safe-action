import { createSafeActionClient } from "next-safe-action";
import { headers } from "next/headers";
import { unauthorized } from "next/navigation";

// Route actions are ordinary actions: nothing on the client marks them as HTTP endpoints. The router does that.
export const actionClient = createSafeActionClient();

// Protected actions. Authentication is ordinary application middleware, so it runs for both transports:
// HTTP requests and Server Action calls.
export const apiKeyClient = actionClient.use(async ({ next }) => {
	// Demonstration only: use a real secret store and a constant-time comparison.
	if ((await headers()).get("x-api-key") !== "demo-key") {
		// The route handlers map this Next.js access signal to a 401 response.
		unauthorized();
	}

	return next({ ctx: { apiClient: "demo-client" } });
});
