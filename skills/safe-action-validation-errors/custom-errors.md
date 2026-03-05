# Custom Validation Errors

## returnValidationErrors

```ts
import { returnValidationErrors } from "next-safe-action";
```

The first argument must be the schema (for type inference). The second argument is the validation errors object matching the schema shape.

### Field-Level Errors

```ts
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const login = actionClient
  .inputSchema(schema)
  .action(async ({ parsedInput }) => {
    const user = await db.user.findByEmail(parsedInput.email);
    if (!user) {
      returnValidationErrors(schema, {
        email: { _errors: ["No account found with this email"] },
      });
    }

    const validPassword = await verifyPassword(parsedInput.password, user.passwordHash);
    if (!validPassword) {
      returnValidationErrors(schema, {
        password: { _errors: ["Incorrect password"] },
      });
    }

    return { userId: user.id };
  });
```

### Multiple Errors Per Field

```ts
returnValidationErrors(schema, {
  password: {
    _errors: [
      "Must contain at least one uppercase letter",
      "Must contain at least one number",
    ],
  },
});
```

### Form-Level + Field-Level Errors

```ts
returnValidationErrors(schema, {
  _errors: ["Unable to complete registration at this time"],
  email: { _errors: ["This email domain is not allowed"] },
});
```

### Nested Object Errors

```ts
const schema = z.object({
  address: z.object({
    street: z.string(),
    city: z.string(),
    zip: z.string(),
  }),
});

returnValidationErrors(schema, {
  address: {
    zip: { _errors: ["Invalid ZIP code for the selected state"] },
  },
});
```

## Error Classes

### ActionServerValidationError

Thrown internally by `returnValidationErrors()`. You don't need to use this directly.

```ts
import { ActionServerValidationError } from "next-safe-action";
```

### ActionValidationError

Thrown when `throwValidationErrors` is enabled and input validation fails. Catch this in try/catch:

```ts
import { ActionValidationError } from "next-safe-action";

try {
  const result = await myAction({ invalidInput: true });
} catch (e) {
  if (e instanceof ActionValidationError) {
    console.log(e.validationErrors); // The validation errors object
    console.log(e.message);          // Error message (default or overridden)
  }
}
```

### ActionBindArgsValidationError

Thrown when bind args fail validation:

```ts
import { ActionBindArgsValidationError } from "next-safe-action";
```

### ActionMetadataValidationError

Thrown when metadata doesn't match `defineMetadataSchema`:

```ts
import { ActionMetadataValidationError } from "next-safe-action";
```

### ActionOutputDataValidationError

Thrown when the action's return value doesn't match `outputSchema`:

```ts
import { ActionOutputDataValidationError } from "next-safe-action";
```
