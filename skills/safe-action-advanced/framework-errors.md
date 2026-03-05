# Framework Errors

## Overview

Next.js uses thrown errors for navigation: `redirect()`, `notFound()`, `forbidden()`, `unauthorized()`. next-safe-action detects these and handles them specially:

1. Framework errors bypass `handleServerError` — they are **not** treated as server errors
2. The error is stored and **re-thrown** after callbacks run, so Next.js handles the navigation
3. The `navigationKind` is set on the result, and `onNavigation` callbacks fire

## Using Navigation in Actions

```ts
"use server";

import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { forbidden, unauthorized } from "next/navigation";
import { z } from "zod";
import { authActionClient } from "@/lib/safe-action";

// Redirect after creation
export const createPost = authActionClient
  .inputSchema(z.object({ title: z.string(), content: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const post = await db.post.create({
      ...parsedInput,
      authorId: ctx.userId,
    });
    redirect(`/posts/${post.id}`);
  });

// Not found
export const getPost = authActionClient
  .inputSchema(z.object({ postId: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const post = await db.post.findById(parsedInput.postId);
    if (!post) {
      notFound();
    }
    return post;
  });

// Forbidden (403)
export const adminAction = authActionClient
  .action(async ({ ctx }) => {
    if (ctx.userRole !== "admin") {
      forbidden();
    }
    return { secret: "data" };
  });

// Unauthorized (401)
export const protectedAction = actionClient
  .action(async () => {
    const session = await getSession();
    if (!session) {
      unauthorized();
    }
    return { data: "protected" };
  });
```

## NavigationKind

```ts
type NavigationKind = "redirect" | "notFound" | "forbidden" | "unauthorized" | "other";
```

`"other"` covers edge cases like CSR bailout, dynamic usage errors, and React postpone.

## Handling Navigation on the Client

### With useAction

Navigation errors are caught, stored, and **re-thrown** by the hook. Next.js picks them up from the re-throw.

```tsx
const { execute, hasNavigated, status } = useAction(createPost, {
  onNavigation: ({ navigationKind }) => {
    // Fires before the re-throw
    console.log(`Navigating: ${navigationKind}`);
  },
});
```

### With executeAsync

`executeAsync` **throws** on navigation errors. Use try/catch and re-throw:

```tsx
const handleSubmit = async () => {
  try {
    const result = await executeAsync(input);
    // Only reached if no navigation occurred
    console.log(result.data);
  } catch (e) {
    // Navigation errors must propagate to Next.js
    throw e;
  }
};
```

## Framework Errors in Middleware

Framework errors thrown in middleware are also detected. If you catch errors in middleware, **always re-throw framework errors**:

```ts
.use(async ({ next }) => {
  try {
    return await next({ ctx: {} });
  } catch (error) {
    // Check before swallowing!
    if (error instanceof Error && "digest" in error) {
      throw error; // Let Next.js handle it
    }
    // Handle non-framework errors
    return { serverError: "Something went wrong" };
  }
})
```

## Server Callbacks with Navigation

Server-level callbacks on `.action()` fire even when navigation occurs:

```ts
export const createPost = authActionClient
  .inputSchema(schema)
  .action(
    async ({ parsedInput }) => {
      const post = await db.post.create(parsedInput);
      redirect(`/posts/${post.id}`);
    },
    {
      onNavigation: async ({ navigationKind }) => {
        // Runs on the server before the error is re-thrown
        console.log("Server: navigation occurred:", navigationKind);
      },
      onSettled: async ({ result }) => {
        // Also runs — good for cleanup/metrics
      },
    }
  );
```
