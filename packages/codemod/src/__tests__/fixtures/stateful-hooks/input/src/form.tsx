"use client";

import { useAction } from "next-safe-action/hooks";
import { useStateAction } from "next-safe-action/stateful-hooks";

export function Form() {
	useAction(async () => undefined);
	useStateAction(async () => undefined);
	return null;
}
