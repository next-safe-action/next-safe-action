import { ActionValidationError, inspectFrameworkError } from "next-safe-action";
import { isParameter, methods } from "./router";
import type { HttpError, RouteContext, RouteHandlersOptions, Router } from "./types";

export { createRouter } from "./router";
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
function isJsonMediaType(mediaType: string) {
	return mediaType === "application/json" || /^application\/[a-z0-9!#$&^_.+-]+\+json$/.test(mediaType);
}
async function readInput(request: Request, limit: number): Promise<unknown> {
	// A declared media type is checked even for an empty body, so an empty cross-site form post cannot run an action.
	const mediaType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
	if (mediaType !== undefined && !isJsonMediaType(mediaType))
		fail(415, "UNSUPPORTED_MEDIA_TYPE", "A JSON content type is required");
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
	if (mediaType === undefined) fail(415, "UNSUPPORTED_MEDIA_TYPE", "A JSON content type is required");
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
// Next.js decodes catch-all segments after splitting, so "%2F" can put a slash inside a single parameter value.
function isParameterValue(value: string | undefined) {
	return !!value && value !== "." && value !== ".." && !value.includes("/");
}
function headerValue(request: Request, name: string) {
	return request.headers.get(name)?.split(",")[0]?.trim() || undefined;
}
// Same-origin detection follows Next.js Server Actions for the host (X-Forwarded-Host, then Host) and additionally
// compares the scheme (X-Forwarded-Proto, then the request URL). Next.js builds `request.url` from the configured
// hostname, not from the request, so its host is used only when no Host header reached the handler.
function isSameOrigin(origin: string, request: Request): boolean {
	const url = new URL(request.url);
	const host = headerValue(request, "x-forwarded-host") ?? headerValue(request, "host") ?? url.host;
	const scheme = headerValue(request, "x-forwarded-proto") ?? url.protocol.slice(0, -1);
	try {
		const expected = new URL(scheme + "://" + host).origin;
		return expected !== "null" && new URL(origin).origin === expected;
	} catch {
		return false;
	}
}
const validationErrorBrand = Symbol.for("next-safe-action.validation-error.v1");
// Also matches errors thrown by a duplicate copy of the core package.
function isValidationError(error: unknown): error is { validationErrors: unknown } {
	return (
		error instanceof ActionValidationError ||
		(error instanceof Error && (error as unknown as Record<symbol, unknown>)[validationErrorBrand] === true)
	);
}
const accessErrors: Record<number, [code: string, message: string]> = {
	401: ["UNAUTHORIZED", "Unauthorized"],
	403: ["FORBIDDEN", "Forbidden"],
	404: ["NOT_FOUND", "Not found"],
};
export function createRouteHandlers(router: Router, options: RouteHandlersOptions = {}) {
	if (!Array.isArray((router as Partial<Router> | undefined)?.routes))
		throw new TypeError("createRouteHandlers expects a router from createRouter()");
	// Concrete templates are matched before parameterized ones. Node 18 does not support toSorted.
	// oxlint-disable-next-line unicorn/no-array-sort
	const table = [...router.routes].sort(
		(a, b) => a.segments.filter(isParameter).length - b.segments.filter(isParameter).length
	);
	const limit = options.maxBodyBytes ?? 1024 * 1024;
	if (!Number.isSafeInteger(limit) || limit < 0) throw new TypeError("Invalid maxBodyBytes");
	const origins = new Set(options.allowedOrigins ?? []);
	for (const origin of origins) {
		if (origin === "null" || new URL(origin).origin !== origin)
			throw new TypeError("Allowed origins must be explicit origins");
	}
	if (options.onError !== undefined && typeof options.onError !== "function") throw new TypeError("Invalid onError");
	const handler = async (request: Request, context: RouteContext): Promise<Response> => {
		const headers = new Headers({ "Cache-Control": "no-store" });
		const json = (body: unknown, status: number) => {
			headers.set("Content-Type", "application/json");
			return new Response(JSON.stringify(body), { status, headers });
		};
		const error = (status: number, code: string, message: string) =>
			json({ httpError: { code, message } } satisfies HttpError, status);
		const internalError = (cause: unknown) => {
			try {
				const reported: unknown = options.onError?.(cause, { request });
				// Reporting must never change or delay the response, so async reporters are not awaited.
				if (reported && typeof (reported as PromiseLike<unknown>).then === "function")
					void Promise.resolve(reported).catch(() => {});
			} catch {
				/* Reporting must never change the response. */
			}
			return error(500, "INTERNAL_ERROR", "Internal server error");
		};
		try {
			const origin = request.headers.get("origin");
			if (origin !== null) {
				if (origin === "null" || (!origins.has(origin) && !isSameOrigin(origin, request)))
					fail(403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed");
			}
			const rawPath = (await context.params)[options.pathParam ?? "path"];
			if (rawPath !== undefined && (!Array.isArray(rawPath) || rawPath.some((part) => typeof part !== "string")))
				fail(400, "INVALID_PATH", "Invalid catch-all path");
			const path = rawPath ?? [];
			const matches = table.filter(
				({ segments }) =>
					segments.length === path.length &&
					segments.every((part, i) => (isParameter(part) ? isParameterValue(path[i]) : part === path[i]))
			);
			const first = matches[0];
			if (!first) return error(404, "NOT_FOUND", "Endpoint not found");
			// Select the most concrete template before selecting its method.
			const routes = matches.filter((route) => route.path === first.path);
			const route = routes.find(({ method }) => method === request.method);
			if (!route) {
				headers.set("Allow", methods.filter((method) => routes.some((match) => match.method === method)).join(", "));
				return error(405, "METHOD_NOT_ALLOWED", "Method is not allowed");
			}
			new Headers(route.config.headers).forEach((value, key) => {
				if (
					key !== "cache-control" &&
					key !== "content-type" &&
					key !== "content-length" &&
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
					const parsed = await route.config.stateSchema!["~standard"].validate(input.prevResult);
					if (parsed.issues) fail(400, "INVALID_STATE", "Invalid previous result");
					prevResult = parsed.value;
				}
				input = input.input;
			}
			if (route.config.mapInput) input = await route.config.mapInput({ input, params, request });
			const result = route.definition.stateful ? await route.action(prevResult, input) : await route.action(input);
			let status = route.config.successStatus ?? 200;
			if (result.validationErrors !== undefined) status = 400;
			else if (result.serverError !== undefined) {
				status = route.config.serverErrorStatus?.(result.serverError) ?? 500;
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
				} catch (invalid) {
					return internalError(invalid);
				}
			}
			if (signal?.kind === "access") {
				const [code, message] = accessErrors[signal.status] ?? ["ACCESS_DENIED", "Access denied"];
				return error(signal.status, code, message);
			}
			if (caught instanceof PreparationError) return error(caught.status, caught.code, caught.message);
			if (isValidationError(caught)) {
				try {
					return json({ validationErrors: caught.validationErrors }, 400);
				} catch (unserializable) {
					return internalError(unserializable);
				}
			}
			return internalError(caught);
		}
	};
	return { POST: handler, PUT: handler, PATCH: handler, DELETE: handler };
}
