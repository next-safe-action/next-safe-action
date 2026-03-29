"use server";

import { forbidden, notFound, redirect, unauthorized } from "next/navigation";
import { z } from "zod";
import { action } from "@/lib/safe-action";

const schema = z.object({
	kind: z.enum(["redirect", "notFound", "forbidden", "unauthorized", "happy-path"]),
});

export const testNavigateMutation = action
	.metadata({ actionName: "testNavigateMutation" })
	.inputSchema(schema)
	.action(async ({ parsedInput: { kind } }) => {
		await new Promise((res) => setTimeout(res, 1000));

		switch (kind) {
			case "redirect":
				redirect("/");
			case "notFound":
				notFound();
			case "forbidden":
				forbidden();
			case "unauthorized":
				unauthorized();
			default:
				return { success: true };
		}
	});
