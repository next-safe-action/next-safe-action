import { createSafeActionClient } from "next-safe-action";

export function makeClient() {
	return createSafeActionClient();
}
