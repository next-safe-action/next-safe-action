"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/safe-action";
import { REVALIDATION_TAG, mutateRevalidationState } from "../_store/revalidation-store";

const schema = z.object({
	kind: z.enum(["revalidatePath", "revalidateTag"]),
});

export const testRevalidation = action
	.metadata({ actionName: "testRevalidation" })
	.inputSchema(schema)
	.action(async ({ parsedInput: { kind } }) => {
		await new Promise((res) => setTimeout(res, 600));

		const snapshot = mutateRevalidationState(kind);

		if (kind === "revalidatePath") {
			revalidatePath("/optimistic-updates");
		} else {
			revalidateTag(REVALIDATION_TAG, "max");
		}

		return {
			ok: true,
			kind,
			snapshot,
			serverTimestamp: new Date().toISOString(),
		};
	});
