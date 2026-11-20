const REACT_POSTPONE_TYPE: symbol = Symbol.for("react.postpone");

// Comes from https://github.com/vercel/next.js/blob/canary/packages/next/src/server/lib/router-utils/is-postpone.ts
export function isPostpone(error: unknown): boolean {
	return typeof error === "object" && error !== null && "$$typeof" in error && error.$$typeof === REACT_POSTPONE_TYPE;
}

// Comes from https://github.com/vercel/next.js/blob/canary/packages/next/src/server/app-render/dynamic-rendering.ts
// (`isDynamicPostpone`). Still produced by Next.js 15.x with `experimental.ppr`.
export function isDynamicPostpone(error: unknown): boolean {
	if (typeof error !== "object" || error === null || !("message" in error) || typeof error.message !== "string") {
		return false;
	}

	return (
		error.message.includes("needs to bail out of prerendering at this point because it used") &&
		error.message.includes("Learn more: https://nextjs.org/docs/messages/ppr-caught-error")
	);
}
