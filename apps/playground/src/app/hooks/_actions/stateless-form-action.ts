"use server";

import { z } from "zod";
import { zfd } from "zod-form-data";
import { action } from "@/lib/safe-action";

const schema = zfd.formData({
	name: zfd.text(z.string().min(1).max(20)),
});

export const statelessFormAction = action
	.metadata({ actionName: "statelessFormAction" })
	.inputSchema(schema)
	.action(async ({ parsedInput }) => {
		await new Promise((res) => setTimeout(res, 1000));
		return {
			newName: parsedInput.name,
		};
	});
