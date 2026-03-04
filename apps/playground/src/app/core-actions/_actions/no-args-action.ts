"use server";

import { action } from "@/lib/safe-action";

export const noArgsAction = action.metadata({ actionName: "noArgsAction" }).action(async () => {
	await new Promise((res) => setTimeout(res, 500));
	return { message: "Well done!" };
});
