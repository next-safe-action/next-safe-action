"use server";

import { z } from "zod";
import { action } from "@/lib/safe-action";

const schema = z.object({
	userId: z.uuid(),
});

export const emptyAction = action
	.metadata({ actionName: "emptyAction" })
	.inputSchema(schema)
	.action(async () => {
		await new Promise((res) => setTimeout(res, 500));
	});
