import type { Auth, BetterAuthOptions } from "better-auth";
import { describe, expect, test, vi } from "vitest";

// ─── Module mocks (hoisted by vitest) ────────────────────────────────

const { mockHeaders, unauthorizedError } = vi.hoisted(() => ({
	mockHeaders: new Headers({ cookie: "test-session-cookie" }),
	unauthorizedError: new Error("NEXT_HTTP_ERROR_FALLBACK;401"),
}));

vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue(mockHeaders),
}));

vi.mock("next/navigation", () => ({
	unauthorized: vi.fn(() => {
		throw unauthorizedError;
	}),
}));

import { betterAuthMiddleware } from "..";

// ─── Test helpers ────────────────────────────────────────────────────

const mockUser = { id: "user-1", name: "Test User", email: "test@example.com", emailVerified: true, image: null };
const mockSession = { id: "session-1", userId: "user-1", token: "tok-abc", expiresAt: new Date() };

function createMockAuth(sessionData: { user: typeof mockUser; session: typeof mockSession } | null) {
	return { api: { getSession: vi.fn().mockResolvedValue(sessionData) } } as unknown as Auth<BetterAuthOptions>;
}

function createMockNext() {
	return vi.fn().mockImplementation((opts?: { ctx?: object }) => Promise.resolve({ success: true, ctx: opts?.ctx }));
}

const baseMiddlewareArgs = {
	clientInput: undefined as unknown,
	bindArgsClientInputs: [] as unknown[],
	metadata: {},
};

// ─── Default flow ────────────────────────────────────────────────────

describe("default flow (no authorize callback)", () => {
	test("calls getSession with headers from next/headers", async () => {
		const auth = createMockAuth({ user: mockUser, session: mockSession });
		const next = createMockNext();
		const middleware = betterAuthMiddleware(auth);

		await middleware({ ...baseMiddlewareArgs, ctx: {}, next });

		expect(auth.api.getSession).toHaveBeenCalledOnce();
		expect(auth.api.getSession).toHaveBeenCalledWith({ headers: mockHeaders });
	});

	test("session exists: calls next with auth context containing user and session", async () => {
		const auth = createMockAuth({ user: mockUser, session: mockSession });
		const next = createMockNext();
		const middleware = betterAuthMiddleware(auth);

		await middleware({ ...baseMiddlewareArgs, ctx: {}, next });

		expect(next).toHaveBeenCalledOnce();
		expect(next).toHaveBeenCalledWith({
			ctx: { auth: { user: mockUser, session: mockSession } },
		});
	});

	test("no session: calls unauthorized() and does not call next", async () => {
		const auth = createMockAuth(null);
		const next = createMockNext();
		const middleware = betterAuthMiddleware(auth);

		await expect(middleware({ ...baseMiddlewareArgs, ctx: {}, next })).rejects.toThrow(unauthorizedError);

		expect(next).not.toHaveBeenCalled();
	});
});

// ─── Custom authorize callback ───────────────────────────────────────

describe("custom authorize callback", () => {
	test("delegates to authorize with auth, sessionData, ctx, and next", async () => {
		const sessionData = { user: mockUser, session: mockSession };
		const auth = createMockAuth(sessionData);
		const next = createMockNext();
		const ctx = { existingKey: "value" };
		const authorize = vi.fn().mockImplementation(({ next: n, sessionData: sd }) =>
			n({ ctx: { auth: sd } })
		);

		const middleware = betterAuthMiddleware(auth, { authorize });

		await middleware({ ...baseMiddlewareArgs, ctx, next });

		expect(authorize).toHaveBeenCalledOnce();
		expect(authorize).toHaveBeenCalledWith({ auth, sessionData, ctx, next });
	});

	test("receives null sessionData when no session exists", async () => {
		const auth = createMockAuth(null);
		const next = createMockNext();
		const authorize = vi.fn().mockImplementation(({ next: n }) => n({ ctx: { custom: true } }));

		const middleware = betterAuthMiddleware(auth, { authorize });

		await middleware({ ...baseMiddlewareArgs, ctx: {}, next });

		expect(authorize).toHaveBeenCalledWith(expect.objectContaining({ sessionData: null }));
	});

	test("authorize can return custom context via next", async () => {
		const auth = createMockAuth({ user: mockUser, session: mockSession });
		const next = createMockNext();
		const authorize = vi.fn().mockImplementation(({ next: n, sessionData: sd }) =>
			n({ ctx: { auth: sd, role: "admin" } })
		);

		const middleware = betterAuthMiddleware(auth, { authorize });

		await middleware({ ...baseMiddlewareArgs, ctx: {}, next });

		expect(next).toHaveBeenCalledWith({ ctx: { auth: { user: mockUser, session: mockSession }, role: "admin" } });
	});

	test("authorize can throw to block the request", async () => {
		const auth = createMockAuth({ user: mockUser, session: mockSession });
		const next = createMockNext();
		const customError = new Error("Forbidden: admin only");
		const authorize = vi.fn().mockRejectedValue(customError);

		const middleware = betterAuthMiddleware(auth, { authorize });

		await expect(middleware({ ...baseMiddlewareArgs, ctx: {}, next })).rejects.toThrow(customError);

		expect(next).not.toHaveBeenCalled();
	});
});

// ─── Error propagation ───────────────────────────────────────────────

describe("error propagation", () => {
	test("getSession error propagates without being caught", async () => {
		const dbError = new Error("Database connection failed");
		const auth = { api: { getSession: vi.fn().mockRejectedValue(dbError) } } as unknown as Auth<BetterAuthOptions>;
		const next = createMockNext();
		const middleware = betterAuthMiddleware(auth);

		await expect(middleware({ ...baseMiddlewareArgs, ctx: {}, next })).rejects.toThrow(dbError);

		expect(next).not.toHaveBeenCalled();
	});

	test("getSession error propagates even with custom authorize", async () => {
		const dbError = new Error("Connection timeout");
		const auth = { api: { getSession: vi.fn().mockRejectedValue(dbError) } } as unknown as Auth<BetterAuthOptions>;
		const next = createMockNext();
		const authorize = vi.fn();

		const middleware = betterAuthMiddleware(auth, { authorize });

		await expect(middleware({ ...baseMiddlewareArgs, ctx: {}, next })).rejects.toThrow(dbError);

		// authorize should never be called if getSession fails
		expect(authorize).not.toHaveBeenCalled();
	});
});
