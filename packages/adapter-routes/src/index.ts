import { ActionValidationError, inspectFrameworkError } from "next-safe-action";
import { isParameter, methods, routeTable } from "./definition";
import type { HttpError, RouteContext, RoutesOptions } from "./types";

export { routesMiddleware } from "./definition";
export type * from "./types";

class PreparationError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string
	) {
		super(message);
	}
}
function fail(status: number, code: string, message: string): never {
	throw new PreparationError(status, code, message);
}
async function readInput(request: Request, limit: number): Promise<unknown> {
	const reader = request.body?.getReader();
	if (!reader) return undefined;
	let size = 0;
	const chunks: Uint8Array[] = [];
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > limit) {
				await reader.cancel();
				fail(413, "BODY_TOO_LARGE", "Request body is too large");
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	if (!size) return undefined;
	const mediaType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
	if (mediaType !== "application/json" && !/^application\/[a-z0-9!#$&^_.+-]+\+json$/.test(mediaType ?? ""))
		fail(415, "UNSUPPORTED_MEDIA_TYPE", "A JSON content type is required");
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	try {
		return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	} catch {
		return fail(400, "INVALID_JSON", "Invalid JSON body");
	}
}
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function createRouteHandlers(options: RoutesOptions) {
	const table = routeTable(options.actions);
	const limit = options.maxBodyBytes ?? 1024 * 1024;
	if (!Number.isSafeInteger(limit) || limit < 0) throw new TypeError("Invalid maxBodyBytes");
	const origins = new Set(options.allowedOrigins ?? []);
	for (const origin of origins) {
		if (origin === "null" || new URL(origin).origin !== origin)
			throw new TypeError("Allowed origins must be explicit origins");
	}
	const allowedHeaders = (options.allowedHeaders ?? ["content-type"]).map((header) => header.toLowerCase());
	const handler = async (request: Request, context: RouteContext): Promise<Response> => {
		const headers = new Headers({ "Cache-Control": "no-store", "Vary": "Origin" });
		const json = (body: unknown, status: number) => {
			headers.set("Content-Type", "application/json");
			headers.set("Cache-Control", "no-store");
			return new Response(JSON.stringify(body), { status, headers });
		};
		const error = (status: number, code: string, message: string) =>
			json({ httpError: { code, message } } satisfies HttpError, status);
		try {
			const origin = request.headers.get("origin");
			if (origin !== null) {
				if (origin === "null" || (origin !== new URL(request.url).origin && !origins.has(origin)))
					fail(403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed");
				headers.set("Access-Control-Allow-Origin", origin);
				if (options.credentials) headers.set("Access-Control-Allow-Credentials", "true");
			}
			const rawPath = (await context.params)[options.pathParam ?? "path"];
			if (rawPath !== undefined && (!Array.isArray(rawPath) || rawPath.some((part) => typeof part !== "string")))
				fail(400, "INVALID_PATH", "Invalid catch-all path");
			const path = rawPath ?? [];
			const matches = table.filter(
				({ segments }) =>
					segments.length === path.length && segments.every((part, i) => isParameter(part) || part === path[i])
			);
			const first = matches[0];
			if (!first) return error(404, "NOT_FOUND", "Endpoint not found");
			// Select the most concrete template before selecting its method.
			const routes = matches.filter((route) => route.endpoint.path === first.endpoint.path);
			const allow = [
				...methods.filter((method) => routes.some((route) => route.endpoint.method === method)),
				"OPTIONS",
			];
			if (request.method === "OPTIONS") {
				headers.set("Allow", allow.join(", "));
				headers.set("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers");
				const requestedMethod = request.headers.get("access-control-request-method");
				if (requestedMethod && !allow.includes(requestedMethod))
					return error(405, "METHOD_NOT_ALLOWED", "Method is not allowed");
				const requestedHeaders =
					request.headers
						.get("access-control-request-headers")
						?.split(",")
						.map((h) => h.trim().toLowerCase()) ?? [];
				if (requestedHeaders.some((header) => !allowedHeaders.includes(header)))
					return error(403, "HEADERS_NOT_ALLOWED", "Request headers are not allowed");
				headers.set("Access-Control-Allow-Methods", allow.join(", "));
				headers.set("Access-Control-Allow-Headers", allowedHeaders.join(", "));
				return new Response(null, { status: 204, headers });
			}
			const route = routes.find(({ endpoint }) => endpoint.method === request.method);
			if (!route) {
				headers.set("Allow", allow.join(", "));
				return error(405, "METHOD_NOT_ALLOWED", "Method is not allowed");
			}
			new Headers(route.endpoint.headers).forEach((value, key) => {
				if (
					key !== "cache-control" &&
					key !== "content-type" &&
					key !== "content-length" &&
					key !== "vary" &&
					!key.startsWith("access-control-")
				)
					headers.append(key, value);
			});
			const params = Object.fromEntries(
				route.segments.flatMap((part, i) => (isParameter(part) ? [[part.slice(1, -1), path[i]!]] : []))
			);
			let input = await readInput(request, limit);
			let prevResult: unknown = {};
			if (route.definition.stateful) {
				if (!isRecord(input) || Object.keys(input).some((key) => key !== "input" && key !== "prevResult"))
					fail(400, "INVALID_STATE", "Invalid state envelope");
				if ("prevResult" in input) {
					const parsed = await route.endpoint.stateSchema!["~standard"].validate(input.prevResult);
					if (parsed.issues) fail(400, "INVALID_STATE", "Invalid previous result");
					prevResult = parsed.value;
				}
				input = input.input;
			}
			if (route.endpoint.mapInput) input = await route.endpoint.mapInput({ input, params, request });
			const result = route.definition.stateful
				? await route.definition.action(prevResult, input)
				: await route.definition.action(input);
			let status = route.endpoint.successStatus ?? 200;
			if (result.validationErrors !== undefined) status = 400;
			else if (result.serverError !== undefined) {
				status = route.endpoint.serverErrorStatus?.(result.serverError) ?? 500;
				if (!Number.isInteger(status) || status < 400 || status > 599)
					throw new TypeError("Invalid server error status");
			}
			return json(result, status);
		} catch (caught) {
			const signal = inspectFrameworkError(caught);
			if (signal?.kind === "other") throw caught;
			if (signal?.kind === "redirect") {
				try {
					headers.set("Location", signal.destination);
					return new Response(null, { status: 303, headers });
				} catch {
					return error(500, "INTERNAL_ERROR", "Internal server error");
				}
			}
			if (signal?.kind === "access") return error(signal.status, "ACCESS_DENIED", "Access denied");
			if (caught instanceof PreparationError) return error(caught.status, caught.code, caught.message);
			if (caught instanceof ActionValidationError) {
				try {
					return json({ validationErrors: caught.validationErrors }, 400);
				} catch {
					/* Fall through to sanitized error. */
				}
			}
			return error(500, "INTERNAL_ERROR", "Internal server error");
		}
	};
	return { POST: handler, PUT: handler, PATCH: handler, DELETE: handler, OPTIONS: handler };
}
