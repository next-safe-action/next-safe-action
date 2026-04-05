import type { Auth } from "better-auth";
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

import { betterAuth } from "..";

// ─── Test helpers ────────────────────────────────────────────────────

const mockUser = { id: "user-1", name: "Test User", email: "test@example.com", emailVerified: true, image: null };
const mockSession = { id: "session-1", userId: "user-1", token: "tok-abc", expiresAt: new Date() };

function createMockAuth(authData: { user: typeof mockUser; session: typeof mockSession } | null) {
	return { api: { getSession: vi.fn().mockResolvedValue(authData) } } as unknown as Auth;
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
		const middleware = betterAuth(auth);

		await middleware({ ...baseMiddlewareArgs, ctx: {}, next });

		expect(auth.api.getSession).toHaveBeenCalledOnce();
		expect(auth.api.getSession).toHaveBeenCalledWith({ headers: mockHeaders });
	});

	test("session exists: calls next with auth context containing user and session", async () => {
		const auth = createMockAuth({ user: mockUser, session: mockSession });
		const next = createMockNext();
		const middleware = betterAuth(auth);

		await middleware({ ...baseMiddlewareArgs, ctx: {}, next });

		expect(next).toHaveBeenCalledOnce();
		expect(next).toHaveBeenCalledWith({
			ctx: { auth: { user: mockUser, session: mockSession } },
		});
	});

	test("no session: calls unauthorized() and does not call next", async () => {
		const auth = createMockAuth(null);
		const next = createMockNext();
		const middleware = betterAuth(auth);

		await expect(middleware({ ...baseMiddlewareArgs, ctx: {}, next })).rejects.toThrow(unauthorizedError);

		expect(next).not.toHaveBeenCalled();
	});
});

// ─── Custom authorize callback ───────────────────────────────────────

describe("custom authorize callback", () => {
	test("delegates to authorize with authData, ctx, and next", async () => {
		const authData = { user: mockUser, session: mockSession };
		const auth = createMockAuth(authData);
		const next = createMockNext();
		const ctx = { existingKey: "value" };
		const authorize = vi.fn().mockImplementation(({ next: n, authData: sd }) => n({ ctx: { auth: sd } }));

		const middleware = betterAuth(auth, { authorize });

		await middleware({ ...baseMiddlewareArgs, ctx, next });

		expect(authorize).toHaveBeenCalledOnce();
		expect(authorize).toHaveBeenCalledWith({ authData, ctx, next });
	});

	test("receives null authData when no session exists", async () => {
		const auth = createMockAuth(null);
		const next = createMockNext();
		const authorize = vi.fn().mockImplementation(({ next: n }) => n({ ctx: { custom: true } }));

		const middleware = betterAuth(auth, { authorize });

		await middleware({ ...baseMiddlewareArgs, ctx: {}, next });

		expect(authorize).toHaveBeenCalledWith(expect.objectContaining({ authData: null }));
	});

	test("authorize can return custom context via next", async () => {
		const auth = createMockAuth({ user: mockUser, session: mockSession });
		const next = createMockNext();
		const authorize = vi
			.fn()
			.mockImplementation(({ next: n, authData: sd }) => n({ ctx: { auth: sd, role: "admin" } }));

		const middleware = betterAuth(auth, { authorize });

		await middleware({ ...baseMiddlewareArgs, ctx: {}, next });

		expect(next).toHaveBeenCalledWith({ ctx: { auth: { user: mockUser, session: mockSession }, role: "admin" } });
	});

	test("authorize can throw to block the request", async () => {
		const auth = createMockAuth({ user: mockUser, session: mockSession });
		const next = createMockNext();
		const customError = new Error("Forbidden: admin only");
		const authorize = vi.fn().mockRejectedValue(customError);

		const middleware = betterAuth(auth, { authorize });

		await expect(middleware({ ...baseMiddlewareArgs, ctx: {}, next })).rejects.toThrow(customError);

		expect(next).not.toHaveBeenCalled();
	});
});

// ─── Context extension with prior middleware ────────────────────────

describe("context extension with prior middleware", () => {
	test("authorize receives ctx from prior middleware and forwards it via next", async () => {
		const authData = { user: mockUser, session: mockSession };
		const auth = createMockAuth(authData);
		const next = createMockNext();
		const priorCtx = { userId: "user-1", orgId: "org-42" };

		const authorize = vi
			.fn()
			.mockImplementation(({ ctx, authData: sd, next: n }) => n({ ctx: { ...ctx, auth: sd } }));

		const middleware = betterAuth(auth, { authorize });

		await middleware({ ...baseMiddlewareArgs, ctx: priorCtx, next });

		expect(authorize).toHaveBeenCalledWith({ authData, ctx: priorCtx, next });
		expect(next).toHaveBeenCalledWith({
			ctx: { userId: "user-1", orgId: "org-42", auth: authData },
		});
	});

	test("default flow preserves prior middleware ctx through next", async () => {
		const auth = createMockAuth({ user: mockUser, session: mockSession });
		const priorCtx = { tenantId: "tenant-1" };
		const next = createMockNext();
		const middleware = betterAuth(auth);

		await middleware({ ...baseMiddlewareArgs, ctx: priorCtx, next });

		// Default flow calls next with auth context; prior ctx is preserved by the action builder's deepmerge
		expect(next).toHaveBeenCalledWith({
			ctx: { auth: { user: mockUser, session: mockSession } },
		});
	});

	test("authorize can selectively extend prior ctx without spreading it", async () => {
		const authData = { user: mockUser, session: mockSession };
		const auth = createMockAuth(authData);
		const next = createMockNext();
		const priorCtx = { userId: "user-1" };

		const authorize = vi.fn().mockImplementation(({ next: n, authData: sd }) =>
			// Only passes new context; prior ctx is preserved by the action builder's deepmerge
			n({ ctx: { auth: sd } })
		);

		const middleware = betterAuth(auth, { authorize });

		await middleware({ ...baseMiddlewareArgs, ctx: priorCtx, next });

		expect(authorize).toHaveBeenCalledWith({ authData, ctx: priorCtx, next });
		expect(next).toHaveBeenCalledWith({ ctx: { auth: authData } });
	});
});

// ─── Error propagation ───────────────────────────────────────────────

describe("error propagation", () => {
	test("getSession error propagates without being caught", async () => {
		const dbError = new Error("Database connection failed");
		const auth = { api: { getSession: vi.fn().mockRejectedValue(dbError) } } as unknown as Auth;
		const next = createMockNext();
		const middleware = betterAuth(auth);

		await expect(middleware({ ...baseMiddlewareArgs, ctx: {}, next })).rejects.toThrow(dbError);

		expect(next).not.toHaveBeenCalled();
	});

	test("getSession error propagates even with custom authorize", async () => {
		const dbError = new Error("Connection timeout");
		const auth = { api: { getSession: vi.fn().mockRejectedValue(dbError) } } as unknown as Auth;
		const next = createMockNext();
		const authorize = vi.fn();

		const middleware = betterAuth(auth, { authorize });

		await expect(middleware({ ...baseMiddlewareArgs, ctx: {}, next })).rejects.toThrow(dbError);

		// authorize should never be called if getSession fails
		expect(authorize).not.toHaveBeenCalled();
	});
});
