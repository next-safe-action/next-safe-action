"use server";

import { action } from "@/lib/safe-action";

export const stateUpdateAction = action.metadata({ actionName: "stateUpdateAction" }).action(async () => {
	await new Promise((res) => setTimeout(res, 1000));
	return {
		message: "Hello, world!",
	};
});
