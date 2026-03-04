"use server";

import { forbidden, notFound, redirect, unauthorized } from "next/navigation";
import { z } from "zod";
import { action } from "@/lib/safe-action";

const schema = z.object({
	kind: z.enum(["redirect", "notFound", "forbidden", "unauthorized", "happy-path"]),
});

export const testNavigate = action
	.metadata({ actionName: "testNavigate" })
	.inputSchema(schema)
	.action(
		async ({ parsedInput: { kind } }) => {
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
		},
		{
			async onSuccess(args) {
				console.log("ON SUCCESS CALLBACK", args);
			},
			async onError(args) {
				console.log("ON ERROR CALLBACK", args);
			},
			async onSettled(args) {
				console.log("ON SETTLED CALLBACK", args);
			},
			async onNavigation(args) {
				console.log("ON NAVIGATION CALLBACK", args);
			},
		}
	);
