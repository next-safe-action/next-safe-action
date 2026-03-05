// Comes from https://github.com/vercel/next.js/blob/canary/packages/next/src/server/lib/router-utils/is-postpone.ts

const REACT_POSTPONE_TYPE: symbol = Symbol.for("react.postpone");

export function isPostpone(error: any): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		// oxlint-disable-next-line
		error.$$typeof === REACT_POSTPONE_TYPE
	);
}
