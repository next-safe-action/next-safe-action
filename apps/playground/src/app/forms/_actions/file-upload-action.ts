"use server";

import { zfd } from "zod-form-data";
import { action } from "@/lib/safe-action";

const schema = zfd.formData({
	image: zfd.file(),
});

export const fileUploadAction = action
	.metadata({ actionName: "fileUploadAction" })
	.inputSchema(schema)
	.action(async ({ parsedInput }) => {
		await new Promise((res) => setTimeout(res, 1000));
		console.log("fileUploadAction ->", parsedInput);
		return { ok: true };
	});
