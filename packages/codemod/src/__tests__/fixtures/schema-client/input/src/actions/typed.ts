import type { SafeActionClient } from "next-safe-action";
import { z } from "zod";

export function withString(client: SafeActionClient) {
	return client.schema(z.string());
}
