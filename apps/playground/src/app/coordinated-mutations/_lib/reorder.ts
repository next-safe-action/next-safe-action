import { z } from "zod";

export const moveSchema = z.object({
	id: z.string(),
	direction: z.enum(["up", "down"]),
});

export type Move = z.infer<typeof moveSchema>;
export type Item = { id: string; label: string };

export const INITIAL_ITEMS: Item[] = [
	{ id: "a", label: "Design review" },
	{ id: "b", label: "Ship the changelog" },
	{ id: "c", label: "Fix the flaky test" },
	{ id: "d", label: "Update the docs" },
];

/**
 * The shared reducer: run optimistically on the client and authoritatively on the server.
 * Deliberately order-sensitive, so an overlapping pair of moves that got raced instead of
 * queued would produce a visibly wrong order.
 *
 * Lives outside the `"use server"` module because every export there must be a server action.
 */
export function reorder(items: Item[], move: Move): Item[] {
	const index = items.findIndex((item) => item.id === move.id);
	if (index === -1) return items;

	const target = move.direction === "up" ? index - 1 : index + 1;
	if (target < 0 || target >= items.length) return items;

	const next = [...items];
	const [moved] = next.splice(index, 1);
	next.splice(target, 0, moved!);
	return next;
}
