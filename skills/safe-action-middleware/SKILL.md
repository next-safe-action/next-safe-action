---
name: safe-action-middleware
description: Use when implementing middleware for next-safe-action -- authentication, authorization, logging, rate limiting, error interception, context extension, or creating standalone reusable middleware with createMiddleware()
---

# next-safe-action Middleware

## Quick Start

```ts
import { createSafeActionClient } from "next-safe-action";

const actionClient = createSafeActionClient();

// Add middleware with .use()
const authClient = actionClient.use(async ({ next }) => {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  // Pass context to the next middleware/action via next({ ctx })
  return next({
    ctx: { userId: session.user.id },
  });
});
```

## How Middleware Works

- `.use()` adds middleware to the chain — you can call it multiple times
- Each `.use()` returns a **new** client instance (immutable chain)
- Middleware executes **top-to-bottom** (in the order added)
- Results flow **bottom-to-top** (the deepest middleware/action resolves first)
- Context is accumulated via `next({ ctx })` — each level's ctx is **deep-merged** with the previous

```ts
const client = createSafeActionClient()
  .use(async ({ next }) => {
    console.log("1: before");             // Runs 1st
    const result = await next({ ctx: { a: 1 } });
    console.log("1: after");              // Runs 4th
    return result;
  })
  .use(async ({ next, ctx }) => {
    console.log("2: before", ctx.a);      // Runs 2nd, ctx.a = 1
    const result = await next({ ctx: { b: 2 } });
    console.log("2: after");              // Runs 3rd
    return result;
  });

// In .action(): ctx = { a: 1, b: 2 }
```

## Middleware Function Signature

```ts
async ({
  clientInput,           // Raw input from the client (unknown)
  bindArgsClientInputs,  // Raw bind args array
  ctx,                   // Accumulated context from previous middleware
  metadata,              // Metadata set via .metadata()
  next,                  // Call to proceed to next middleware/action
}) => {
  // Optionally extend context
  return next({ ctx: { /* new context properties */ } });
}
```

## Supporting Docs

- [Authentication & authorization patterns](./auth-patterns.md)
- [Logging & monitoring middleware](./logging-monitoring.md)
- [Standalone reusable middleware with createMiddleware()](./standalone-middleware.md)

## Anti-Patterns

```ts
// BAD: Forgetting to return next() — action will hang
.use(async ({ next }) => {
  await doSomething();
  next({ ctx: {} }); // Missing return!
})

// GOOD: Always return the result of next()
.use(async ({ next }) => {
  await doSomething();
  return next({ ctx: {} });
})
```

```ts
// BAD: Catching all errors (swallows framework errors like redirect/notFound)
.use(async ({ next }) => {
  try {
    return await next({ ctx: {} });
  } catch (error) {
    return { serverError: "Something went wrong" }; // Swallows redirect!
  }
})

// GOOD: Re-throw framework errors
import { FrameworkErrorHandler } from "next-safe-action/next/errors";

.use(async ({ next }) => {
  try {
    return await next({ ctx: {} });
  } catch (error) {
    if (FrameworkErrorHandler.isNavigationError(error)) {
      throw error; // Let Next.js handle redirects, notFound, etc.
    }
    // Handle other errors
    console.error(error);
    return { serverError: "Something went wrong" };
  }
})
```
