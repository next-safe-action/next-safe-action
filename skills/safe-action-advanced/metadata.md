# Metadata

## What Is Metadata?

Metadata is typed data attached to each action, accessible in middleware and server callbacks. Common uses: action names for logging, feature flags, permission requirements.

## Define a Metadata Schema

```ts
import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";

export const actionClient = createSafeActionClient({
  defineMetadataSchema: () =>
    z.object({
      actionName: z.string(),
    }),
});
```

When `defineMetadataSchema` is set, every action **must** call `.metadata()` before `.action()` — TypeScript enforces this.

## Set Metadata Per Action

```ts
export const createUser = actionClient
  .metadata({ actionName: "createUser" })
  .inputSchema(z.object({ name: z.string() }))
  .action(async ({ parsedInput, metadata }) => {
    // metadata.actionName === "createUser"
    return { name: parsedInput.name };
  });
```

## Access Metadata in Middleware

```ts
export const actionClient = createSafeActionClient({
  defineMetadataSchema: () =>
    z.object({
      actionName: z.string(),
      requiresAuth: z.boolean().default(false),
    }),
}).use(async ({ next, metadata }) => {
  // metadata is fully typed: { actionName: string; requiresAuth: boolean }

  if (metadata.requiresAuth) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    return next({ ctx: { userId: session.user.id } });
  }

  return next({ ctx: {} });
});
```

```ts
// Public action
export const getPublicData = actionClient
  .metadata({ actionName: "getPublicData", requiresAuth: false })
  .action(async () => ({ data: "public" }));

// Protected action
export const getUserData = actionClient
  .metadata({ actionName: "getUserData", requiresAuth: true })
  .action(async ({ ctx }) => {
    // ctx.userId is available because requiresAuth triggered the auth middleware
    return await db.user.findById(ctx.userId);
  });
```

## Metadata for Logging

```ts
const actionClient = createSafeActionClient({
  defineMetadataSchema: () =>
    z.object({ actionName: z.string() }),
}).use(async ({ next, metadata }) => {
  const start = performance.now();
  const result = await next({ ctx: {} });
  const duration = performance.now() - start;

  console.log(`[${metadata.actionName}] ${duration.toFixed(0)}ms`, {
    success: !!result.data,
    hasError: !!result.serverError,
  });

  return result;
});
```

## Metadata Validation Errors

If metadata doesn't match the schema, `ActionMetadataValidationError` is thrown at runtime. TypeScript catches most issues at compile time, but runtime validation is a safety net.

## Rich Metadata Schemas

```ts
const actionClient = createSafeActionClient({
  defineMetadataSchema: () =>
    z.object({
      actionName: z.string(),
      category: z.enum(["user", "post", "admin", "system"]),
      rateLimit: z.number().int().positive().optional(),
      audit: z.boolean().default(true),
    }),
});

export const deleteUser = actionClient
  .metadata({
    actionName: "deleteUser",
    category: "admin",
    rateLimit: 5,
    audit: true,
  })
  .inputSchema(z.object({ userId: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    await db.user.delete(parsedInput.userId);
    return { deleted: true };
  });
```
