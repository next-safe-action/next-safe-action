import { createMiddleware } from "next-safe-action";
import type { ActionDefinition } from "next-safe-action";
import type { EndpointMetadata, RoutesMiddlewareOptions, RoutesOptions } from "./types";

const descriptorKey = Symbol.for("next-safe-action.adapter-routes.v1");
export const methods = ["POST", "PUT", "PATCH", "DELETE"] as const;
export type RouteDefinition = {
	version: 1;
	definition: ActionDefinition;
	endpoint: Readonly<EndpointMetadata>;
	defaults: RoutesMiddlewareOptions["openapiDefaults"];
	segments: string[];
};

export function segments(path: string): string[] {
	if (typeof path !== "string" || !path.startsWith("/") || (path !== "/" && path.endsWith("/")))
		throw new TypeError("Invalid endpoint path");
	const parts = path === "/" ? [] : path.slice(1).split("/");
	const names = new Set<string>();
	for (const part of parts) {
		if (/^\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(part)) {
			if (names.has(part)) throw new TypeError("Duplicate path parameter");
			names.add(part);
		} else if (!part || /[{}*?#%\\]/.test(part) || part === "." || part === "..")
			throw new TypeError("Invalid endpoint segment");
	}
	return parts;
}
export function isParameter(segment: string) {
	return segment.startsWith("{");
}

export function routesMiddleware<ServerError = any>(options: RoutesMiddlewareOptions = {}) {
	if (options.openapi !== undefined && options.openapi !== "opt-in" && options.openapi !== "required")
		throw new TypeError("Invalid OpenAPI mode");
	return createMiddleware<{ serverError: ServerError }>().define(async ({ next }) => next(), {
		onActionDefined(definition) {
			const endpoint = (definition.metadata as { endpoint?: EndpointMetadata } | undefined)?.endpoint;
			if (endpoint === undefined) {
				if (options.requireEndpoint) throw new TypeError("Endpoint metadata is required");
				return;
			}
			if (!endpoint || typeof endpoint !== "object") throw new TypeError("Invalid endpoint metadata");
			for (const callback of [endpoint.mapInput, endpoint.serverErrorStatus]) {
				if (callback !== undefined && typeof callback !== "function")
					throw new TypeError("Endpoint callbacks must be functions");
			}
			if (!methods.includes(endpoint.method)) throw new TypeError("Unsupported endpoint method");
			if (definition.bindArgsCount) throw new TypeError("Route actions cannot have bind arguments");
			if (definition.stateful && typeof endpoint.stateSchema?.["~standard"]?.validate !== "function")
				throw new TypeError("Stateful endpoints require stateSchema");
			const status = endpoint.successStatus ?? 200;
			if (!Number.isInteger(status) || status < 200 || status > 299 || status === 204 || status === 205)
				throw new TypeError("successStatus must allow a JSON body");
			if (options.openapi === "required" && !endpoint.openapi)
				throw new TypeError("Endpoint OpenAPI configuration is required");
			const descriptor: RouteDefinition = {
				version: 1,
				definition,
				endpoint: Object.freeze({
					...endpoint,
					headers: endpoint.headers ? [...new Headers(endpoint.headers)] : undefined,
				}),
				defaults: options.openapiDefaults ? { ...options.openapiDefaults } : undefined,
				segments: segments(endpoint.path),
			};
			Object.defineProperty(definition.action, descriptorKey, { value: Object.freeze(descriptor) });
		},
	});
}

export function routeTable(actions: RoutesOptions["actions"]): RouteDefinition[] {
	const table: RouteDefinition[] = [];
	for (const action of actions) {
		if (action.name.startsWith("bound ")) throw new TypeError("Bound actions cannot be registered");
		const descriptor = (action as unknown as Record<symbol, RouteDefinition>)[descriptorKey];
		if (!descriptor) continue;
		if (descriptor.version !== 1 || descriptor.definition.action !== action)
			throw new TypeError("Invalid route action descriptor");
		for (const existing of table) {
			const a = existing.segments,
				b = descriptor.segments;
			if (a.length !== b.length || !a.every((part, i) => part === b[i] || isParameter(part) || isParameter(b[i]!)))
				continue;
			const aMore = a.some((part, i) => !isParameter(part) && isParameter(b[i]!));
			const bMore = b.some((part, i) => !isParameter(part) && isParameter(a[i]!));
			if (
				(aMore && bMore) ||
				(!aMore &&
					!bMore &&
					(existing.endpoint.path !== descriptor.endpoint.path ||
						existing.endpoint.method === descriptor.endpoint.method))
			) {
				throw new TypeError("Duplicate or ambiguous endpoint: " + descriptor.endpoint.path);
			}
		}
		table.push(descriptor);
	}
	// Node 18 does not support toSorted; this array is local to compilation.
	// oxlint-disable-next-line unicorn/no-array-sort
	return table.sort((a, b) => a.segments.filter(isParameter).length - b.segments.filter(isParameter).length);
}
