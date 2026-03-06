# Authentication & Authorization Middleware

> **Note:** Action files require a `"use server"` directive — omitted from examples below for brevity.

## Session Lookup

```ts
import { createSafeActionClient } from "next-safe-action";
import { getSession } from "@/lib/auth";

const actionClient = createSafeActionClient();

// Require authenticated session
export const authActionClient = actionClient.use(async ({ next }) => {
  const session = await getSession();

  if (!session?.user) {
    throw new Error("You must be logged in to perform this action.");
  }

  return next({
    ctx: {
      userId: session.user.id,
      userEmail: session.user.email,
      userRole: session.user.role,
    },
  });
});
```

## Role-Based Authorization

Layer role checks on top of the auth middleware:

```ts
// Admin-only actions
export const adminActionClient = authActionClient.use(async ({ next, ctx }) => {
  if (ctx.userRole !== "admin") {
    throw new Error("Admin access required.");
  }
  return next({ ctx });
});

// Organization member actions
// IMPORTANT: clientInput is raw/unvalidated in middleware (validation runs after middleware).
// Always validate values used for authorization decisions.
export const orgActionClient = authActionClient
  .inputSchema(z.object({ orgId: z.string().uuid() }))
  .use(async ({ next, ctx, clientInput }) => {
    const parsed = z.object({ orgId: z.string().uuid() }).safeParse(clientInput);
    if (!parsed.success) throw new Error("Invalid input");

    const membership = await db.orgMember.find({
      userId: ctx.userId,
      orgId: parsed.data.orgId,
    });

    if (!membership) {
      throw new Error("You are not a member of this organization.");
    }

    return next({
      ctx: { orgRole: membership.role, orgId: parsed.data.orgId },
    });
  });
```

## Resource Ownership

Check that the user owns the resource they're modifying:

```ts
export const updatePost = authActionClient
  .inputSchema(z.object({ postId: z.string().uuid(), title: z.string() }))
  .use(async ({ next, ctx, clientInput }) => {
    const input = clientInput as { postId: string };
    const post = await db.post.findById(input.postId);

    if (!post) {
      throw new Error("Post not found");
    }
    if (post.authorId !== ctx.userId) {
      throw new Error("You can only edit your own posts");
    }

    return next({ ctx: { post } }); // Pass the fetched post to avoid re-querying
  })
  .action(async ({ parsedInput, ctx }) => {
    // ctx.post is available — no need to query again
    await db.post.update(ctx.post.id, { title: parsedInput.title });
    return { success: true };
  });
```

## API Key Authentication

For actions called from external services:

```ts
export const apiActionClient = actionClient.use(async ({ next }) => {
  const headersList = await headers();
  const apiKey = headersList.get("x-api-key");

  if (!apiKey) {
    throw new Error("API key required");
  }

  const keyRecord = await db.apiKey.findByKey(apiKey);
  if (!keyRecord || keyRecord.revoked) {
    throw new Error("Invalid API key");
  }

  return next({
    ctx: { apiKeyId: keyRecord.id, permissions: keyRecord.permissions },
  });
});
```
