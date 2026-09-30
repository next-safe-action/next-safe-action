import { getActionDefinition } from "next-safe-action";
import type { MutationMethod, Route, RouteAction, Router } from "./types";

export const methods = ["POST", "PUT", "PATCH", "DELETE"] as const satisfies readonly MutationMethod[];

export function isParameter(segment: string) {
	return segment.startsWith("{");
}
function segments(path: string): string[] {
	if (typeof path !== "string" || !path.startsWith("/") || (path !== "/" && path.endsWith("/")))
		throw new TypeError("Invalid route path: " + path);
	const parts = path === "/" ? [] : path.slice(1).split("/");
	const names = new Set<string>();
	for (const part of parts) {
		if (/^\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(part)) {
			if (names.has(part)) throw new TypeError("Duplicate path parameter: " + path);
			names.add(part);
		} else if (!part || /[{}*?#%\\]/.test(part) || part === "." || part === "..")
			throw new TypeError("Invalid route segment: " + path);
	}
	return parts;
}
// Two templates conflict when they match the same request and neither is more concrete in every differing segment.
function conflicts(a: Route, b: Pick<Route, "method" | "path" | "segments">) {
	const x = a.segments,
		y = b.segments;
	if (x.length !== y.length || !x.every((part, i) => part === y[i] || isParameter(part) || isParameter(y[i]!)))
		return false;
	const xMore = x.some((part, i) => !isParameter(part) && isParameter(y[i]!));
	const yMore = y.some((part, i) => !isParameter(part) && isParameter(x[i]!));
	return (xMore && yMore) || (!xMore && !yMore && (a.path !== b.path || a.method === b.method));
}

function compile(method: MutationMethod, path: string, action: RouteAction, config: Route["config"] = {}): Route {
	const label = method + " " + path;
	const definition = getActionDefinition(action);
	if (!definition) throw new TypeError(label + ": not a safe action (bound actions are not supported)");
	if (definition.bindArgsCount) throw new TypeError(label + ": actions with bind arguments are not supported");
	if (!config || typeof config !== "object") throw new TypeError(label + ": invalid route config");
	for (const callback of [config.mapInput, config.serverErrorStatus]) {
		if (callback !== undefined && typeof callback !== "function")
			throw new TypeError(label + ": route callbacks must be functions");
	}
	if (definition.stateful && typeof config.stateSchema?.["~standard"]?.validate !== "function")
		throw new TypeError(label + ": stateful actions require stateSchema");
	const status = config.successStatus ?? 200;
	if (!Number.isInteger(status) || status < 200 || status > 299 || status === 204 || status === 205)
		throw new TypeError(label + ": successStatus must allow a JSON body");
	const parts = segments(path);
	if (parts.some(isParameter) && !config.mapInput) throw new TypeError(label + ": path parameters require mapInput");
	return Object.freeze({
		method,
		path,
		segments: Object.freeze(parts),
		action,
		definition,
		config: Object.freeze({ ...config, headers: config.headers ? [...new Headers(config.headers)] : undefined }),
	});
}

function router(routes: readonly Route[]): Router {
	const add =
		(method: MutationMethod) =>
		(path: string, action: RouteAction, config?: Route["config"]): Router => {
			const route = compile(method, path, action, config);
			if (routes.some((existing) => conflicts(existing, route)))
				throw new TypeError("Duplicate or ambiguous route: " + method + " " + path);
			return router(Object.freeze([...routes, route]));
		};
	return Object.freeze({ routes, post: add("POST"), put: add("PUT"), patch: add("PATCH"), delete: add("DELETE") });
}

/**
 * Creates an empty router. Add actions with `.post()`, `.put()`, `.patch()` and `.delete()`, then pass the router
 * to `createRouteHandlers()` and, optionally, to `generateOpenApiDocument()`.
 */
export function createRouter(): Router {
	return router(Object.freeze([]));
}
