# Validation Error Shapes

> **Note:** Action files require a `"use server"` directive — omitted from examples below for brevity.

## Formatted (Default)

Nested structure mirroring the schema, with `_errors` arrays at each level:

```ts
// Schema: z.object({ email: z.string().email(), name: z.string().min(2) })
// Formatted errors:
{
  _errors: [],                    // root-level errors
  email: { _errors: ["Invalid email"] },
  name: { _errors: ["Too short"] },
}
```

Access: `result.validationErrors?.email?._errors?.[0]`

## Flattened

Flat structure with `formErrors` (root) and `fieldErrors` (one level deep):

```ts
// Same schema, flattened errors:
{
  formErrors: [],                       // root-level errors
  fieldErrors: {
    email: ["Invalid email"],
    name: ["Too short"],
  },
}
```

Access: `result.validationErrors?.fieldErrors?.email?.[0]`

**Note:** Flattened mode only processes one level deep. Nested object field errors are not included.

## Setting the Default Shape

### Client-Level Default

```ts
import { createSafeActionClient } from "next-safe-action";

export const actionClient = createSafeActionClient({
  defaultValidationErrorsShape: "flattened", // "formatted" | "flattened"
});
```

All actions created from this client will use the flattened shape by default.

### Per-Action Override

Override the shape for a specific action using `handleValidationErrorsShape` in `.inputSchema()`:

```ts
import { flattenValidationErrors, formatValidationErrors } from "next-safe-action";

// Client uses "formatted" by default, but this action uses "flattened"
export const myAction = actionClient
  .inputSchema(
    z.object({ email: z.string().email() }),
    {
      handleValidationErrorsShape: async (ve) => flattenValidationErrors(ve),
    }
  )
  .action(async ({ parsedInput }) => {
    // ...
  });
```

### Custom Shape

Return any shape you want from `handleValidationErrorsShape`:

```ts
export const myAction = actionClient
  .inputSchema(
    z.object({ email: z.string().email(), name: z.string() }),
    {
      handleValidationErrorsShape: async (ve) => {
        // Custom: just a flat record of field → first error
        const errors: Record<string, string> = {};
        for (const [key, value] of Object.entries(ve)) {
          if (key !== "_errors" && value?._errors?.[0]) {
            errors[key] = value._errors[0];
          }
        }
        return errors;
      },
    }
  )
  .action(async ({ parsedInput }) => { /* ... */ });

// result.validationErrors: { email?: string; name?: string }
```

## Utility Functions

### formatValidationErrors(ve)

Identity function — returns errors as-is (formatted shape). Useful when you want to be explicit:

```ts
import { formatValidationErrors } from "next-safe-action";

handleValidationErrorsShape: async (ve) => formatValidationErrors(ve),
```

### flattenValidationErrors(ve)

Converts formatted → flattened shape:

```ts
import { flattenValidationErrors } from "next-safe-action";

handleValidationErrorsShape: async (ve) => flattenValidationErrors(ve),
```

## handleValidationErrorsShape Receives Context

The function receives a second `utils` argument with full context:

```ts
handleValidationErrorsShape: async (ve, { clientInput, bindArgsClientInputs, metadata, ctx }) => {
  // Log the validation failure with context
  logger.warn("Validation failed", {
    action: metadata.actionName,
    userId: ctx.userId,
    errors: ve,
  });
  return flattenValidationErrors(ve);
},
```

## throwValidationErrors

When enabled, validation errors throw `ActionValidationError` instead of being returned in `result.validationErrors`. The thrown error contains the **shaped** validation errors (after `handleValidationErrorsShape` runs).

```ts
// Enable globally
const actionClient = createSafeActionClient({
  throwValidationErrors: true,
});

// Or per-action
export const myAction = actionClient
  .inputSchema(schema)
  .action(serverCodeFn, {
    throwValidationErrors: true,
  });

// With custom error message
export const myAction = actionClient
  .inputSchema(schema)
  .action(serverCodeFn, {
    throwValidationErrors: {
      overrideErrorMessage: async (validationErrors) =>
        `Validation failed: ${JSON.stringify(validationErrors)}`,
    },
  });
```
