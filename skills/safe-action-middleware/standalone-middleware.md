# Standalone Reusable Middleware

> **Note:** Action files require a `"use server"` directive — omitted from examples below for brevity.

## createMiddleware()

`createMiddleware()` creates type-safe, reusable middleware that can be shared across multiple clients. It uses a curried `.define()` pattern for generic type inference.

```ts
import { createMiddleware } from "next-safe-action";
```

## Basic Usage

```ts
const logMiddleware = createMiddleware().define(async ({ next, clientInput }) => {
  console.log("Input:", clientInput);
  const result = await next();
  console.log("Result:", result);
  return result;
});

// Use in any client
const client1 = createSafeActionClient().use(logMiddleware);
const client2 = createSafeActionClient().use(logMiddleware);
```

## With Type Constraints

Specify minimum requirements for the middleware using the generic parameter. The middleware will only be compatible with clients that satisfy these constraints.

```ts
// This middleware requires:
// - ctx must have userId (string)
// - metadata must have actionName (string)
const auditMiddleware = createMiddleware<{
  ctx: { userId: string };
  metadata: { actionName: string };
}>().define(async ({ next, ctx, metadata }) => {
  // ctx.userId and metadata.actionName are typed
  await db.auditLog.create({
    userId: ctx.userId,
    action: metadata.actionName,
    timestamp: new Date(),
  });

  return next();
});

// Works — authClient already provides userId in ctx
const authClient = createSafeActionClient({
  defineMetadataSchema: () => z.object({ actionName: z.string() }),
})
  .use(async ({ next }) => {
    const session = await getSession();
    return next({ ctx: { userId: session!.user.id } });
  })
  .use(auditMiddleware); // Type-safe!

// Error — baseClient doesn't have userId in ctx
const baseClient = createSafeActionClient();
baseClient.use(auditMiddleware); // TypeScript error!
```

## Constraining Server Error Type

```ts
// Middleware that expects structured server errors
const errorTrackingMiddleware = createMiddleware<{
  serverError: { message: string; code: string };
}>().define(async ({ next }) => {
  const result = await next();
  if (result.serverError) {
    // result.serverError is typed as { message: string; code: string }
    trackError(result.serverError.code);
  }
  return result;
});
```

## Context Extension

Standalone middleware can extend context just like inline middleware:

```ts
const timingMiddleware = createMiddleware().define(async ({ next }) => {
  const start = performance.now();
  const result = await next({
    ctx: { requestStartTime: start },
  });
  return result;
});

// Later middleware/action can access ctx.requestStartTime
const client = createSafeActionClient()
  .use(timingMiddleware)
  .use(async ({ next, ctx }) => {
    // ctx.requestStartTime is available and typed
    return next();
  });
```

## Composing Multiple Standalone Middleware

```ts
const withTiming = createMiddleware().define(async ({ next }) => {
  const start = performance.now();
  const result = await next({ ctx: { timing: { start } } });
  return result;
});

const withRequestId = createMiddleware().define(async ({ next }) => {
  return next({ ctx: { requestId: crypto.randomUUID() } });
});

const withAuth = createMiddleware().define(async ({ next }) => {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return next({ ctx: { userId: session.user.id } });
});

// Compose in order
export const actionClient = createSafeActionClient()
  .use(withTiming)
  .use(withRequestId)
  .use(withAuth);

// Action ctx: { timing: { start: number }, requestId: string, userId: string }
```
