"use server";

import { metaClient } from "@/lib/safe-action";
import { z } from "zod";

export const c = metaClient
	.use(async ({ next }) => next())
	.metadata({ name: "c" })
	.schema(z.string())
	.outputSchema(z.string())
	.action(async ({ parsedInput }) => parsedInput);
