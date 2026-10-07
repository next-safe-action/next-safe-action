"use server";

import { actionClient } from "@/lib/safe-action";
import { z } from "zod";

export async function build() {
	const actionClient = { schema: (s: unknown) => s };
	return actionClient.schema("x");
}

export const d = actionClient.schema(z.string()).action(async () => null);
