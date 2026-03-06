---
name: safe-action-client
description: Use when creating or configuring a next-safe-action client, defining actions with input/output validation, handling server errors, or setting up createSafeActionClient with Standard Schema (Zod, Yup, Valibot)
---

# next-safe-action Client & Action Definition

## Quick Start

```ts
// src/lib/safe-action.ts
import { createSafeActionClient } from "next-safe-action";

export const actionClient = createSafeActionClient();
```

```ts
// src/app/actions.ts
"use server";

import { z } from "zod";
import { actionClient } from "@/lib/safe-action";

export const greetUser = actionClient
  .inputSchema(z.object({ name: z.string().min(1) }))
  .action(async ({ parsedInput: { name } }) => {
    return { greeting: `Hello, ${name}!` };
  });
```

## Chainable API Order

```
createSafeActionClient(opts?)
  .use(middleware)              // repeatable, adds middleware to chain
  .metadata(data)              // required if defineMetadataSchema is set
  .inputSchema(schema, utils?) // Standard Schema or async factory function
  .bindArgsSchemas([...])      // schemas for .bind() arguments (order with inputSchema is flexible)
  .outputSchema(schema)        // validates action return value
  .action(serverCodeFn, utils?)      // creates SafeActionFn
  .stateAction(serverCodeFn, utils?) // creates SafeStateActionFn (for useActionState)
```

Each method returns a new client instance — the chain is immutable.

## Entry Points

| Entry point | Environment | Exports |
|---|---|---|
| `next-safe-action` | Server | `createSafeActionClient`, `createMiddleware`, `returnValidationErrors`, `flattenValidationErrors`, `formatValidationErrors`, `DEFAULT_SERVER_ERROR_MESSAGE`, error classes, all core types |
| `next-safe-action/hooks` | Client | `useAction`, `useOptimisticAction`, hook types |
| `next-safe-action/stateful-hooks` | Client | `useStateAction` (deprecated — use React's `useActionState` directly) |

## Supporting Docs

- [Client setup & configuration](./client-setup.md)
- [Input & output validation with Standard Schema](./input-output-validation.md)
- [Server error handling](./error-handling.md)

## Anti-Patterns

```ts
// BAD: Missing "use server" directive — action won't work
import { actionClient } from "@/lib/safe-action";
export const myAction = actionClient.action(async () => {});

// GOOD: Always include "use server" in action files
"use server";
import { actionClient } from "@/lib/safe-action";
export const myAction = actionClient.action(async () => {});
```

```ts
// BAD: Calling .action() without .metadata() when metadataSchema is defined
const client = createSafeActionClient({
  defineMetadataSchema: () => z.object({ actionName: z.string() }),
});
client.action(async () => {}); // TypeScript error!

// GOOD: Always provide metadata before .action() when schema is defined
client
  .metadata({ actionName: "myAction" })
  .action(async () => {});
```

```ts
// BAD: Returning an error instead of throwing
export const myAction = actionClient
  .inputSchema(z.object({ email: z.string().email() }))
  .action(async ({ parsedInput }) => {
    const exists = await db.user.findByEmail(parsedInput.email);
    if (exists) {
      return { error: "Email taken" }; // Not type-safe, not standardized
    }
  });

// GOOD: Use returnValidationErrors for field-level errors
import { returnValidationErrors } from "next-safe-action";

export const myAction = actionClient
  .inputSchema(z.object({ email: z.string().email() }))
  .action(async ({ parsedInput }) => {
    const exists = await db.user.findByEmail(parsedInput.email);
    if (exists) {
      returnValidationErrors(z.object({ email: z.string().email() }), {
        email: { _errors: ["Email is already in use"] },
      });
    }
    return { success: true };
  });
```

## Server Code Function Parameters

The function passed to `.action()` receives a single object:

```ts
.action(async ({
  parsedInput,           // validated input (typed from inputSchema)
  clientInput,           // raw client input (unknown)
  bindArgsParsedInputs,  // validated bind args tuple
  bindArgsClientInputs,  // raw bind args
  ctx,                   // context from middleware chain
  metadata,              // metadata set via .metadata()
}) => {
  // return data
});
```

For `.stateAction()`, a second argument is added:

```ts
.stateAction(async ({ parsedInput, ctx }, { prevResult }) => {
  // prevResult is the previous SafeActionResult (structuredClone'd)
  return { count: (prevResult.data?.count ?? 0) + 1 };
});
```
