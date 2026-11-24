import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";

export const actionClient = createSafeActionClient();

export const authClient = actionClient.use(async ({ next }) => next({ ctx: { userId: "1" } }));

export const metaClient = createSafeActionClient({
	defineMetadataSchema: () => z.object({ name: z.string() }),
});
