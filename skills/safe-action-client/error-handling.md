# Server Error Handling

## How Errors Flow

1. An error is thrown inside server code or middleware
2. Framework errors (redirect, notFound, etc.) are detected and re-thrown — they bypass `handleServerError`
3. All other errors pass through `handleServerError`
4. The return value of `handleServerError` becomes `result.serverError` on the client

## handleServerError

```ts
import { createSafeActionClient } from "next-safe-action";

export const actionClient = createSafeActionClient({
  handleServerError: (error) => {
    // `error` is always an Error instance.
    // Non-Error throws are wrapped: new Error(DEFAULT_SERVER_ERROR_MESSAGE)

    if (error instanceof DatabaseError) {
      return "A database error occurred. Please try again.";
    }

    if (error instanceof AuthError) {
      return "Authentication failed. Please log in again.";
    }

    // Default: generic message (never leak internal details to client)
    return "Something went wrong. Please try again.";
  },
});
```

## Custom Error Classes

Define domain-specific error classes to enable structured error handling:

```ts
// src/lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, "NOT_FOUND");
  }
}

export class PermissionError extends AppError {
  constructor() {
    super("You do not have permission", "FORBIDDEN");
  }
}
```

```ts
// src/lib/safe-action.ts
import { createSafeActionClient } from "next-safe-action";
import { AppError } from "@/lib/errors";

export const actionClient = createSafeActionClient({
  handleServerError: (error) => {
    if (error instanceof AppError) {
      return error.message; // Safe, controlled messages
    }
    console.error("Unexpected error:", error);
    return "An unexpected error occurred.";
  },
});
```

```ts
// src/app/actions.ts
"use server";

import { NotFoundError } from "@/lib/errors";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

export const getPost = authActionClient
  .inputSchema(z.object({ postId: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const post = await db.post.findById(parsedInput.postId);
    if (!post) {
      throw new NotFoundError("Post");
      // result.serverError = "Post not found"
    }
    return post;
  });
```

## Structured Server Errors

Return objects instead of strings for richer client-side handling:

```ts
const actionClient = createSafeActionClient({
  handleServerError: (error) => {
    if (error instanceof AppError) {
      return { message: error.message, code: error.code };
    }
    return { message: "An unexpected error occurred", code: "INTERNAL" };
  },
});

// On the client:
const { result } = useAction(myAction);
if (result.serverError) {
  // result.serverError is typed as { message: string; code: string }
  showToast(result.serverError.message);
}
```

## Error Classes Provided by next-safe-action

| Class | Thrown When | Holds |
|---|---|---|
| `ActionValidationError` | `throwValidationErrors` is enabled and input fails validation | `.validationErrors` |
| `ActionBindArgsValidationError` | Bind args fail validation | `.validationErrors` |
| `ActionMetadataValidationError` | Metadata fails schema validation | `.validationErrors` |
| `ActionOutputDataValidationError` | Output fails schema validation | `.validationErrors` |

These are all importable from `next-safe-action`:

```ts
import {
  ActionValidationError,
  ActionBindArgsValidationError,
  ActionMetadataValidationError,
  ActionOutputDataValidationError,
} from "next-safe-action";
```

> **Note:** `ActionServerValidationError` is internal — used by `returnValidationErrors()` but not exported from the package.

## throwValidationErrors

When enabled, input validation errors throw `ActionValidationError` instead of returning `result.validationErrors`. This is useful for catching errors in middleware or try/catch blocks.

```ts
// Enable globally
const actionClient = createSafeActionClient({
  throwValidationErrors: true,
});

// Or per-action
export const myAction = actionClient
  .inputSchema(z.object({ name: z.string() }))
  .action(async ({ parsedInput }) => {
    return { name: parsedInput.name };
  }, {
    throwValidationErrors: true,
  });
```

With custom error message:

```ts
.action(serverCodeFn, {
  throwValidationErrors: {
    overrideErrorMessage: async (validationErrors) => {
      return "Invalid input: check your form fields";
    },
  },
});
```
