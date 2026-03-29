import { DEFAULT_SERVER_ERROR_MESSAGE, createMiddleware, createSafeActionClient } from "next-safe-action";
import { z } from "zod";

export class ActionError extends Error {}

// --- Base action client ---

export const action = createSafeActionClient({
	handleServerError: (e) => {
		console.error("Action server error occurred:", e.message);

		if (e instanceof ActionError) {
			return e.message;
		}

		return DEFAULT_SERVER_ERROR_MESSAGE;
	},
	defineMetadataSchema() {
		return z.object({
			actionName: z.string(),
		});
	},
}).use(async ({ next, metadata, clientInput, bindArgsClientInputs }) => {
	const start = Date.now();
	const result = await next();
	const end = Date.now();
	const durationInMs = end - start;

	const logObject: Record<string, any> = { durationInMs };
	logObject.clientInput = clientInput;
	logObject.bindArgsClientInputs = bindArgsClientInputs;
	logObject.metadata = metadata;
	logObject.result = result;

	console.log("LOGGING FROM MIDDLEWARE:");
	console.dir(logObject, { depth: null });

	return result;
});

// --- Auth action client (extends base) ---

async function getSessionId() {
	return crypto.randomUUID();
}

export const authAction = action
	.use(async ({ next }) => {
		const userId = crypto.randomUUID();
		console.log("FIRST AUTH ACTION MIDDLEWARE, USER ID:", userId);
		return next({
			ctx: {
				userId,
			},
		});
	})
	.use(async ({ ctx, next }) => {
		await new Promise((res) => setTimeout(res, Math.max(Math.random() * 2000, 500)));
		const sessionId = await getSessionId();
		console.log("SECOND AUTH ACTION MIDDLEWARE, SESSION ID:", sessionId);
		return next({
			ctx: {
				...ctx,
				sessionId,
			},
		});
	});

// --- Throwing validation errors client ---

export const throwingAction = createSafeActionClient({
	throwValidationErrors: true,
	handleServerError: (e) => {
		console.error("Action server error occurred:", e.message);

		if (e instanceof ActionError) {
			return e.message;
		}

		return DEFAULT_SERVER_ERROR_MESSAGE;
	},
	defineMetadataSchema() {
		return z.object({
			actionName: z.string(),
		});
	},
});

// --- Flattened validation errors client ---

export const flattenedAction = createSafeActionClient({
	defaultValidationErrorsShape: "flattened",
	handleServerError: (e) => {
		console.error("Action server error occurred:", e.message);

		if (e instanceof ActionError) {
			return e.message;
		}

		return DEFAULT_SERVER_ERROR_MESSAGE;
	},
	defineMetadataSchema() {
		return z.object({
			actionName: z.string(),
		});
	},
});

// --- Standalone middleware: logging ---

export const loggingMiddleware = createMiddleware().define(async ({ next, clientInput }) => {
	console.log("STANDALONE LOGGING MIDDLEWARE, input:", clientInput);
	const start = Date.now();
	const result = await next();
	console.log(`STANDALONE LOGGING MIDDLEWARE, completed in ${Date.now() - start}ms`);
	return result;
});

// --- Standalone middleware: error handling ---

export class DatabaseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DatabaseError";
	}
}

export const errorHandlingMiddleware = createMiddleware().define(async ({ next }) => {
	try {
		return await next();
	} catch (e) {
		if (e instanceof DatabaseError) {
			console.error("Database error caught by middleware:", e.message);
			throw new ActionError(`Database operation failed: ${e.message}`);
		}
		throw e;
	}
});

// --- Standalone middleware: rate limiting ---

const rateLimitStore = new Map<string, number[]>();

export const rateLimitMiddleware = createMiddleware<{ ctx: { userId: string } }>().define(async ({ next, ctx }) => {
	const windowMs = 10_000;
	const maxCalls = 5;
	const now = Date.now();
	const userId = ctx.userId;

	const timestamps = rateLimitStore.get(userId) ?? [];
	const recent = timestamps.filter((t) => now - t < windowMs);

	if (recent.length >= maxCalls) {
		throw new ActionError(`Rate limit exceeded. Max ${maxCalls} calls per ${windowMs / 1000}s.`);
	}

	recent.push(now);
	rateLimitStore.set(userId, recent);

	return next();
});
