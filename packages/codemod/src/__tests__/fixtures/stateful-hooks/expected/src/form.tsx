"use client";

import { useAction, useStateAction } from "next-safe-action/hooks";

export function Form() {
	useAction(async () => undefined);
	useStateAction(async () => undefined);
	return null;
}
