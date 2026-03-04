import { unstable_cache } from "next/cache";
import { connection } from "next/server";

export const REVALIDATION_TAG = "playground-revalidation";

export type RevalidationKind = "revalidatePath" | "revalidateTag";

type RevalidationState = {
	mutationCount: number;
	pathRevalidationCount: number;
	tagRevalidationCount: number;
	lastMutationKind: RevalidationKind | null;
	lastMutationAt: string | null;
};

let state: RevalidationState = {
	mutationCount: 0,
	pathRevalidationCount: 0,
	tagRevalidationCount: 0,
	lastMutationKind: null,
	lastMutationAt: null,
};

const getTaggedSnapshotCached = unstable_cache(
	async () => {
		return {
			...state,
			cachedAt: new Date().toISOString(),
		};
	},
	["playground-revalidation-tagged-snapshot"],
	{
		tags: [REVALIDATION_TAG],
	}
);

export function mutateRevalidationState(kind: RevalidationKind) {
	state = {
		...state,
		mutationCount: state.mutationCount + 1,
		pathRevalidationCount: state.pathRevalidationCount + (kind === "revalidatePath" ? 1 : 0),
		tagRevalidationCount: state.tagRevalidationCount + (kind === "revalidateTag" ? 1 : 0),
		lastMutationKind: kind,
		lastMutationAt: new Date().toISOString(),
	};
	return { ...state };
}

export async function getLiveSnapshot() {
	await connection();
	return {
		...state,
		readAt: new Date().toISOString(),
	};
}

export async function getTaggedSnapshot() {
	return getTaggedSnapshotCached();
}
