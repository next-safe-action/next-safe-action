---
name: safe-action-advanced
description: Use when working with bind arguments, metadata schemas, framework errors (redirect/notFound/forbidden/unauthorized), type inference utilities (InferSafeActionFnInput/Result), or server-level action callbacks
---

# next-safe-action Advanced Features

## Overview

| Feature | Use Case |
|---|---|
| [Bind arguments](./bind-arguments.md) | Pass extra args to actions via `.bind()` (e.g., resource IDs) |
| [Metadata](./metadata.md) | Attach typed metadata to actions for use in middleware |
| [Framework errors](./framework-errors.md) | Handle redirect, notFound, forbidden, unauthorized in actions |
| [Type utilities](./type-utilities.md) | Infer types from action functions and middleware |

## Server-Level Action Callbacks

The second argument to `.action()` accepts callbacks that run **on the server** (not client-side hooks):

```ts
export const createPost = authActionClient
  .inputSchema(schema)
  .action(
    async ({ parsedInput, ctx }) => {
      const post = await db.post.create(parsedInput);
      return post;
    },
    {
      onSuccess: async ({ data, parsedInput, ctx, metadata, clientInput }) => {
        // Runs on the server after successful execution
        await invalidateCache("posts");
      },
      onError: async ({ error }) => {
        // error: { serverError?, validationErrors? }
        await logError(error);
      },
      onSettled: async ({ result }) => {
        // Always runs
        await recordMetrics(result);
      },
      onNavigation: async ({ navigationKind }) => {
        // Runs when a framework error (redirect, notFound, etc.) occurs
        console.log("Navigation:", navigationKind);
      },
    }
  );
```

These are distinct from hook callbacks (`useAction({ onSuccess })`) — server callbacks run in the Node.js runtime, hook callbacks run in the browser.

## throwServerError

Re-throw server errors instead of returning them as `result.serverError`:

```ts
export const myAction = actionClient
  .inputSchema(schema)
  .action(serverCodeFn, {
    throwServerError: true,
    // The original error is re-thrown (not the handled version)
  });
```
