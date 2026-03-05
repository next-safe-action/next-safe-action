---
name: safe-action-testing
description: Use when writing tests for next-safe-action actions or hooks -- Vitest patterns for testing server actions directly, middleware behavior, hooks with React Testing Library, validation errors, and server errors
---

# Testing next-safe-action

## Testing Actions Directly

Server actions are async functions — call them directly in tests:

```ts
// src/__tests__/actions.test.ts
import { describe, it, expect, vi } from "vitest";
import { createUser } from "@/app/actions";

describe("createUser", () => {
  it("returns user data on valid input", async () => {
    const result = await createUser({ name: "Alice", email: "alice@example.com" });

    expect(result.data).toEqual({
      id: expect.any(String),
      name: "Alice",
    });
    expect(result.serverError).toBeUndefined();
    expect(result.validationErrors).toBeUndefined();
  });

  it("returns validation errors on invalid input", async () => {
    const result = await createUser({ name: "", email: "not-an-email" });

    expect(result.data).toBeUndefined();
    expect(result.validationErrors).toBeDefined();
    expect(result.validationErrors?.email?._errors).toContain("Invalid email");
  });

  it("returns server error on duplicate email", async () => {
    // Setup: create first user
    await createUser({ name: "Alice", email: "alice@example.com" });

    // Attempt duplicate
    const result = await createUser({ name: "Bob", email: "alice@example.com" });

    // If using returnValidationErrors:
    expect(result.validationErrors?.email?._errors).toContain("Email already in use");

    // OR if using throw + handleServerError:
    // expect(result.serverError).toBe("Email already in use");
  });
});
```

## Testing Actions with Bind Args

```ts
import { updatePost } from "@/app/actions";

describe("updatePost", () => {
  it("updates the post", async () => {
    const postId = "123e4567-e89b-12d3-a456-426614174000";
    const boundAction = updatePost.bind(null, postId);

    const result = await boundAction({
      title: "Updated Title",
      content: "Updated content",
    });

    expect(result.data).toEqual({ success: true });
  });

  it("returns validation error for invalid postId", async () => {
    const boundAction = updatePost.bind(null, "not-a-uuid");

    // Bind args validation errors throw ActionBindArgsValidationError
    await expect(boundAction({ title: "Test", content: "Test" }))
      .rejects.toThrow();
  });
});
```

## Testing Middleware

Test middleware behavior by creating actions with specific middleware chains:

```ts
import { describe, it, expect, vi } from "vitest";
import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";

// Mock auth
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

import { getSession } from "@/lib/auth";

const authClient = createSafeActionClient().use(async ({ next }) => {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
  return next({ ctx: { userId: session.user.id } });
});

const testAction = authClient.action(async ({ ctx }) => {
  return { userId: ctx.userId };
});

describe("auth middleware", () => {
  it("passes userId to action when authenticated", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "user-1", role: "user" },
    });

    const result = await testAction();
    expect(result.data).toEqual({ userId: "user-1" });
  });

  it("returns server error when unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const result = await testAction();
    expect(result.serverError).toBeDefined();
  });
});
```

## Testing Hooks

Use React Testing Library's `renderHook`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAction } from "next-safe-action/hooks";

// Mock the action
const mockAction = vi.fn();

describe("useAction", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => useAction(mockAction));

    expect(result.current.isIdle).toBe(true);
    expect(result.current.isExecuting).toBe(false);
    expect(result.current.result).toEqual({});
  });

  it("executes and returns data", async () => {
    mockAction.mockResolvedValue({ data: { id: "1" } });

    const { result } = renderHook(() =>
      useAction(mockAction, {
        onSuccess: vi.fn(),
      })
    );

    act(() => {
      result.current.execute({ name: "Alice" });
    });

    await waitFor(() => {
      expect(result.current.hasSucceeded).toBe(true);
    });

    expect(result.current.result.data).toEqual({ id: "1" });
  });

  it("handles server errors", async () => {
    mockAction.mockResolvedValue({ serverError: "Something went wrong" });

    const onError = vi.fn();
    const { result } = renderHook(() => useAction(mockAction, { onError }));

    act(() => {
      result.current.execute({});
    });

    await waitFor(() => {
      expect(result.current.hasErrored).toBe(true);
    });

    expect(result.current.result.serverError).toBe("Something went wrong");
    expect(onError).toHaveBeenCalled();
  });

  it("resets state", async () => {
    mockAction.mockResolvedValue({ data: { id: "1" } });

    const { result } = renderHook(() => useAction(mockAction));

    act(() => {
      result.current.execute({});
    });

    await waitFor(() => {
      expect(result.current.hasSucceeded).toBe(true);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.isIdle).toBe(true);
    expect(result.current.result).toEqual({});
  });
});
```

## Testing Validation Errors

```ts
import { flattenValidationErrors, formatValidationErrors } from "next-safe-action";

describe("validation error utilities", () => {
  const formatted = {
    _errors: ["Form error"],
    email: { _errors: ["Invalid email"] },
    name: { _errors: ["Too short", "Must start with uppercase"] },
  };

  it("flattenValidationErrors", () => {
    const flattened = flattenValidationErrors(formatted);

    expect(flattened.formErrors).toEqual(["Form error"]);
    expect(flattened.fieldErrors.email).toEqual(["Invalid email"]);
    expect(flattened.fieldErrors.name).toEqual(["Too short", "Must start with uppercase"]);
  });

  it("formatValidationErrors is identity", () => {
    expect(formatValidationErrors(formatted)).toBe(formatted);
  });
});
```

## Mocking Framework Errors

```ts
import { vi } from "vitest";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), {
      digest: `NEXT_REDIRECT;push;${url};303;`,
    });
  }),
  notFound: vi.fn(() => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), {
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  }),
}));
```

## Test File Organization

Follow the project convention:

```
packages/next-safe-action/src/__tests__/
├── action-builder.test.ts     # Core execution tests
├── validation-errors.test.ts  # Validation error utilities
├── hooks.test.ts              # useAction, useOptimisticAction
└── middleware.test.ts          # Middleware chain behavior
```

Run tests:
```bash
# All tests
pnpm run test:lib

# Single file
cd packages/next-safe-action && npx vitest run ./src/__tests__/action-builder.test.ts
```
