"use server";

import { routesMiddleware } from "@next-safe-action/adapter-routes";
import type { EndpointMetadata } from "@next-safe-action/adapter-routes";
import { createSafeActionClient } from "next-safe-action";
import { cookies } from "next/headers";
import { z } from "zod";

// Demonstration only. Add application authentication before routesMiddleware.
const client = createSafeActionClient({
	defineMetadataSchema: () => z.object({ endpoint: z.custom<EndpointMetadata>() }),
}).use(routesMiddleware());

export const routeCounter = client
	.metadata({ endpoint: { method: "POST", path: "/counter" } })
	.inputSchema(z.object({ amount: z.number().int() }))
	.outputSchema(z.object({ count: z.number() }))
	.action(async ({ parsedInput }) => {
		const jar = await cookies();
		const count = Number(jar.get("route-counter")?.value ?? 0) + parsedInput.amount;
		jar.set("route-counter", String(count), { httpOnly: true, sameSite: "lax", path: "/" });
		return { count };
	});
