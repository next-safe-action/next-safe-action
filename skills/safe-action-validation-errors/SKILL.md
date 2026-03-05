---
name: safe-action-validation-errors
description: Use when working with validation errors -- returnValidationErrors, formatted vs flattened shapes, custom validation error shapes, throwValidationErrors, or displaying field-level and form-level errors
---

# next-safe-action Validation Errors

## Two Sources of Validation Errors

1. **Schema validation** — automatic when input doesn't match `.inputSchema()`
2. **Manual validation** — via `returnValidationErrors()` in server code (e.g., "email already taken")

Both produce the same error structure on the client.

## Default Error Shape (Formatted)

Mirrors the schema structure with `_errors` arrays at each level:

```ts
// For schema: z.object({ email: z.string().email(), address: z.object({ city: z.string() }) })
{
  _errors: ["Form-level error"],                    // root errors
  email: { _errors: ["Invalid email address"] },    // field errors
  address: {
    _errors: ["Address section error"],
    city: { _errors: ["City is required"] },        // nested field errors
  },
}
```

## returnValidationErrors

Throws a `ActionServerValidationError` that the framework catches and returns as `result.validationErrors`. **It never returns** — it always throws.

```ts
"use server";

import { z } from "zod";
import { returnValidationErrors } from "next-safe-action";
import { actionClient } from "@/lib/safe-action";

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
});

export const register = actionClient
  .inputSchema(registerSchema)
  .action(async ({ parsedInput }) => {
    // Check business rules after schema validation passes
    const existingUser = await db.user.findByEmail(parsedInput.email);
    if (existingUser) {
      returnValidationErrors(registerSchema, {
        email: { _errors: ["This email is already registered"] },
      });
    }

    const existingUsername = await db.user.findByUsername(parsedInput.username);
    if (existingUsername) {
      returnValidationErrors(registerSchema, {
        username: { _errors: ["This username is taken"] },
      });
    }

    // Both checks passed — create the user
    const user = await db.user.create(parsedInput);
    return { id: user.id };
  });
```

### Root-Level Errors

Use `_errors` at the top level for form-wide errors:

```ts
returnValidationErrors(schema, {
  _errors: ["You can only create 5 posts per day"],
});
```

## Supporting Docs

- [Custom validation errors and returnValidationErrors patterns](./custom-errors.md)
- [Formatted vs flattened shapes, per-action override](./error-shapes.md)

## Displaying Validation Errors

```tsx
// Formatted shape (default)
{result.validationErrors?.email?._errors?.map((error) => (
  <p key={error} className="text-red-500">{error}</p>
))}

// Root-level errors
{result.validationErrors?._errors?.map((error) => (
  <p key={error} className="text-red-500">{error}</p>
))}
```

```tsx
// Flattened shape
{result.validationErrors?.fieldErrors?.email?.map((error) => (
  <p key={error} className="text-red-500">{error}</p>
))}

// Form-level errors (flattened)
{result.validationErrors?.formErrors?.map((error) => (
  <p key={error} className="text-red-500">{error}</p>
))}
```
