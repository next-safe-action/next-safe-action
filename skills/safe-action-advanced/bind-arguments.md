# Bind Arguments

## What Are Bind Arguments?

Bind arguments let you pass extra validated arguments to an action using `.bind()`. This is useful for passing resource IDs, configuration, or other data that isn't part of the form input.

## Defining Bind Args

```ts
// src/app/actions.ts
"use server";

import { z } from "zod";
import { authActionClient } from "@/lib/safe-action";

export const updatePost = authActionClient
  .bindArgsSchemas([
    z.string().uuid(),  // postId — first bind arg
  ])
  .inputSchema(
    z.object({
      title: z.string().min(1),
      content: z.string(),
    })
  )
  .action(async ({ parsedInput, bindArgsParsedInputs: [postId], ctx }) => {
    await db.post.update(postId, {
      title: parsedInput.title,
      content: parsedInput.content,
    });
    return { success: true };
  });
```

## Using Bind Args on the Client

Call `.bind(null, ...args)` to create a bound version of the action:

```tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { updatePost } from "@/app/actions";

export function EditPostForm({ postId }: { postId: string }) {
  // Bind the postId as the first argument
  const boundAction = updatePost.bind(null, postId);
  const { execute, isPending } = useAction(boundAction);

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      execute({
        title: fd.get("title") as string,
        content: fd.get("content") as string,
      });
    }}>
      <input name="title" />
      <textarea name="content" />
      <button disabled={isPending}>Save</button>
    </form>
  );
}
```

## Multiple Bind Args

```ts
export const transferItem = authActionClient
  .bindArgsSchemas([
    z.string().uuid(),  // fromWarehouseId
    z.string().uuid(),  // toWarehouseId
  ])
  .inputSchema(z.object({ itemId: z.string().uuid(), quantity: z.number().int().positive() }))
  .action(async ({ parsedInput, bindArgsParsedInputs: [fromId, toId] }) => {
    await db.transfer.create({
      fromWarehouseId: fromId,
      toWarehouseId: toId,
      itemId: parsedInput.itemId,
      quantity: parsedInput.quantity,
    });
    return { success: true };
  });

// Client:
const bound = transferItem.bind(null, warehouse1.id, warehouse2.id);
```

## Bind Args Validation Errors

If bind args fail validation, `ActionBindArgsValidationError` is thrown. It is caught by `handleServerError` and returned as `result.serverError`.

## Bind Args in Middleware

Middleware receives `bindArgsClientInputs` (raw, unvalidated):

```ts
.use(async ({ next, bindArgsClientInputs }) => {
  // bindArgsClientInputs is unknown[] — raw client inputs
  console.log("Bind args:", bindArgsClientInputs);
  return next({ ctx: {} });
})
```

Validated bind args (`bindArgsParsedInputs`) are only available in the server code function, not in middleware.
