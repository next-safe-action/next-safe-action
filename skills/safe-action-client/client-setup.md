# Client Setup & Configuration

## createSafeActionClient Options

```ts
import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";

export const actionClient = createSafeActionClient({
  // Optional: define a metadata schema (actions must call .metadata() before .action())
  defineMetadataSchema: () =>
    z.object({
      actionName: z.string(),
    }),

  // Optional: customize how server errors are handled
  handleServerError: (error) => {
    // Log the error server-side
    console.error("Action error:", error.message);
    // Return a user-facing message (this becomes result.serverError)
    return "Something went wrong. Please try again.";
  },

  // Optional: set default validation error shape for all actions
  // "formatted" (default) = nested { _errors: string[] }
  // "flattened" = { formErrors: string[], fieldErrors: { [field]: string[] } }
  defaultValidationErrorsShape: "formatted",

  // Optional: throw validation errors instead of returning them
  throwValidationErrors: false,
});
```

## Layered Clients Pattern

Build specialized clients by extending a base client with middleware:

```ts
// src/lib/safe-action.ts
import { createSafeActionClient } from "next-safe-action";

// Base client — no auth required
export const actionClient = createSafeActionClient({
  handleServerError: (error) => {
    console.error("Action error:", error.message);
    return error.message;
  },
});

// Auth client — requires authenticated session
export const authActionClient = actionClient.use(async ({ next }) => {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return next({
    ctx: { userId: session.user.id, userRole: session.user.role },
  });
});

// Admin client — requires admin role
export const adminActionClient = authActionClient.use(async ({ next, ctx }) => {
  if (ctx.userRole !== "admin") {
    throw new Error("Forbidden");
  }
  return next({ ctx });
});
```

Then use the appropriate client per action:

```ts
"use server";

import { z } from "zod";
import { actionClient, authActionClient, adminActionClient } from "@/lib/safe-action";

// Public action — no auth needed
export const getPublicData = actionClient.action(async () => {
  return { data: "public" };
});

// Authenticated action — session required
export const getUserProfile = authActionClient.action(async ({ ctx }) => {
  const profile = await db.user.findById(ctx.userId);
  return profile;
});

// Admin action — admin role required
export const deleteUser = adminActionClient
  .inputSchema(z.object({ targetUserId: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    await db.user.delete(parsedInput.targetUserId);
    return { deleted: true };
  });
```

## Custom Server Error Type

By default, `serverError` is a `string`. For structured errors:

```ts
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
  }
}

const actionClient = createSafeActionClient({
  handleServerError: (error) => {
    if (error instanceof AppError) {
      return {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      };
    }
    return {
      message: "An unexpected error occurred",
      code: "INTERNAL_ERROR",
      statusCode: 500,
    };
  },
});
```

The return type of `handleServerError` determines the `ServerError` generic throughout the entire client chain.

## DEFAULT_SERVER_ERROR_MESSAGE

When `handleServerError` is not provided, any non-Error throws produce this default message:

```ts
import { DEFAULT_SERVER_ERROR_MESSAGE } from "next-safe-action";
// Value: "Something went wrong while executing the operation."
```

You can use this constant in your own `handleServerError` as a fallback:

```ts
import { DEFAULT_SERVER_ERROR_MESSAGE } from "next-safe-action";

const actionClient = createSafeActionClient({
  handleServerError: (error) => {
    if (error instanceof AppError) {
      return error.message;
    }
    return DEFAULT_SERVER_ERROR_MESSAGE;
  },
});
```
