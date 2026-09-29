import { generateOpenApiDocument } from "@next-safe-action/adapter-routes/openapi";
import { routeActions } from "@/app/routes/_lib/route-actions";

export function GET() {
	return Response.json(
		generateOpenApiDocument({
			actions: routeActions,
			info: { title: "next-safe-action playground", version: "1.0.0" },
			servers: [{ url: "/api/routes" }],
		})
	);
}
