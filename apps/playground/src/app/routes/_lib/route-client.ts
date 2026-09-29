import { routesMiddleware } from "@next-safe-action/adapter-routes";
import type { EndpointMetadata } from "@next-safe-action/adapter-routes";
import { createSafeActionClient } from "next-safe-action";
import { headers } from "next/headers";
import { unauthorized } from "next/navigation";
import { z } from "zod";

const baseClient = createSafeActionClient({
	defineMetadataSchema: () => z.object({ endpoint: z.custom<EndpointMetadata>() }),
});

// Every route action must be documented, and all of them share the same error shapes: the default
// `handleServerError` returns a string, and validation errors use the default formatted shape.
const routes = routesMiddleware({
	openapi: "required",
	openapiDefaults: {
		serverErrorSchema: { type: "string" },
		validationErrorsSchema: {
			type: "object",
			description: "Formatted validation errors: `_errors` holds root errors, each field holds its own `_errors`.",
		},
	},
});

// Public endpoints.
export const routeClient = baseClient.use(routes);

// Protected endpoints. Authentication is ordinary application middleware, placed before `routesMiddleware`.
// It runs for both transports: HTTP requests and Server Action calls.
export const apiKeyClient = baseClient
	.use(async ({ next }) => {
		// Demonstration only: use a real secret store and a constant-time comparison.
		if ((await headers()).get("x-api-key") !== "demo-key") {
			// The adapter maps this Next.js access signal to a 401 response.
			unauthorized();
		}

		return next({ ctx: { apiClient: "demo-client" } });
	})
	.use(routes);
