import { generateOpenApiDocument } from "@next-safe-action/adapter-routes/openapi";
import { router } from "@/app/routes/_lib/router";

export function GET() {
	return Response.json(
		generateOpenApiDocument(router, {
			info: { title: "next-safe-action playground", version: "1.0.0" },
			servers: [{ url: "/api/routes" }],
			// Every route shares the same error shapes: the default `handleServerError` returns a string, and validation
			// errors use the default formatted shape. A route's `openapi` object can override them.
			serverErrorSchema: { type: "string" },
			validationErrorsSchema: {
				type: "object",
				description: "Formatted validation errors: `_errors` holds root errors, each field holds its own `_errors`.",
			},
		})
	);
}
