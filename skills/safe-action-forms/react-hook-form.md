# React Hook Form Adapter

## Installation

```bash
npm install @next-safe-action/adapter-react-hook-form react-hook-form @hookform/resolvers
```

## useHookFormAction

Composes `useAction` + `useForm` with automatic server validation error mapping.

```tsx
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { zodResolver } from "@hookform/resolvers/zod";
```

### Signature

```ts
const { form, action, handleSubmitWithAction, resetFormAndAction } = useHookFormAction(
  safeActionFn,      // The safe action function
  hookFormResolver,  // zodResolver(schema), yupResolver(schema), etc.
  props?,            // { actionProps?, formProps?, errorMapProps? }
);
```

### Return Value

| Property | Type | Description |
|---|---|---|
| `form` | `UseFormReturn` | The react-hook-form `useForm` return value |
| `action` | `UseActionHookReturn` | The `useAction` return value |
| `handleSubmitWithAction` | `(e?) => Promise<void>` | Bound `handleSubmit(executeAsync)` |
| `resetFormAndAction` | `() => void` | Resets both form and action state |

### Props

```ts
{
  // Callbacks for the underlying useAction
  actionProps: {
    onSuccess: ({ data }) => { ... },
    onError: ({ error }) => { ... },
    onSettled: ({ result }) => { ... },
  },

  // react-hook-form useForm options (except resolver, which is the 2nd arg)
  formProps: {
    defaultValues: { name: "", email: "" },
    mode: "onBlur",
  },

  // Error mapping options
  errorMapProps: {
    joinBy: ", ", // How to join multiple errors per field (default: " ")
  },
}
```

### Complete Example

```tsx
"use client";

import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createUser } from "@/app/actions";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  role: z.enum(["user", "admin"]),
});

export function CreateUserForm() {
  const { form, action, handleSubmitWithAction, resetFormAndAction } =
    useHookFormAction(createUser, zodResolver(schema), {
      actionProps: {
        onSuccess: ({ data }) => {
          toast.success(`User ${data.name} created!`);
          resetFormAndAction();
        },
        onError: ({ error }) => {
          if (error.serverError) {
            toast.error(error.serverError);
          }
        },
      },
      formProps: {
        defaultValues: { name: "", email: "", role: "user" },
      },
    });

  return (
    <form onSubmit={handleSubmitWithAction}>
      <div>
        <input {...form.register("name")} placeholder="Name" />
        {form.formState.errors.name && (
          <span>{form.formState.errors.name.message}</span>
        )}
      </div>

      <div>
        <input {...form.register("email")} placeholder="Email" />
        {form.formState.errors.email && (
          <span>{form.formState.errors.email.message}</span>
        )}
      </div>

      <div>
        <select {...form.register("role")}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <button type="submit" disabled={action.isPending}>
        {action.isPending ? "Creating..." : "Create User"}
      </button>
    </form>
  );
}
```

## How Error Mapping Works

When the action returns `validationErrors`, the adapter maps them to react-hook-form's `FieldErrors` format:

```
Server: { email: { _errors: ["Email taken", "Try another"] } }
   ↓ mapToHookFormErrors({ joinBy: " " })
RHF:    { email: { type: "validate", message: "Email taken Try another" } }
```

Root-level `_errors` are mapped to the `root` key in `form.formState.errors`.

## useHookFormOptimisticAction

Same API as `useHookFormAction`, but wraps `useOptimisticAction` instead:

```tsx
const { form, action, handleSubmitWithAction } = useHookFormOptimisticAction(
  updateSettings,
  zodResolver(schema),
  {
    actionProps: {
      currentState: settings,
      updateFn: (state, input) => ({ ...state, ...input }),
    },
  }
);

// action.optimisticState is available
```

## mapToHookFormErrors (Standalone)

For manual integration without the hooks:

```ts
import { mapToHookFormErrors } from "@next-safe-action/adapter-react-hook-form";

const hookFormErrors = mapToHookFormErrors(result.validationErrors, {
  joinBy: ", ",
});
// Returns FieldErrors compatible with react-hook-form
```

## useHookFormActionErrorMapper (Low-Level)

A React hook that memoizes the error mapping:

```ts
import { useHookFormActionErrorMapper } from "@next-safe-action/adapter-react-hook-form/hooks";

const { hookFormValidationErrors } = useHookFormActionErrorMapper(
  result.validationErrors,
  { joinBy: ", " }
);

// Pass to useForm's errors option
const form = useForm({
  resolver: zodResolver(schema),
  errors: hookFormValidationErrors,
});
```
