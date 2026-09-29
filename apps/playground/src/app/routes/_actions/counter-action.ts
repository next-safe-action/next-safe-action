"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { routeClient } from "../_lib/route-client";

export const routeCounter = routeClient
	.metadata({
		endpoint: {
			method: "POST",
			path: "/counter",
			openapi: { operationId: "incrementCounter", summary: "Increment the cookie counter", tags: ["counter"] },
		},
	})
	.inputSchema(z.object({ amount: z.number().int().min(1).max(100) }))
	.outputSchema(z.object({ count: z.number().int().nonnegative() }))
	.action(async ({ parsedInput }) => {
		const jar = await cookies();
		const count = Number(jar.get("route-counter")?.value ?? 0) + parsedInput.amount;
		jar.set("route-counter", String(count), { httpOnly: true, sameSite: "lax", path: "/" });
		return { count };
	});
