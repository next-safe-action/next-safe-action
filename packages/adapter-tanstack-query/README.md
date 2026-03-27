# @next-safe-action/adapter-tanstack-query

TanStack Query mutation adapter for [next-safe-action](https://github.com/next-safe-action/next-safe-action).

This adapter provides a `mutationOptions()` factory function that creates a properly typed `UseMutationOptions` object for use with TanStack Query's `useMutation` hook. It bridges next-safe-action's result-based error model to TanStack Query's thrown-error model using a typed `ActionMutationError` class.

**Mutations only.** This adapter intentionally does not support queries. Server Actions are not suitable for data fetching — the React and Next.js teams recommend against it due to waterfall issues, lack of caching, and no request deduplication.

## Installation

```bash
npm i @next-safe-action/adapter-tanstack-query @tanstack/react-query next-safe-action
```

## Requirements

- `next-safe-action` >= 8.1.10
- `@tanstack/react-query` >= 5.0.0
- `next` >= 14.0.0
- `react` >= 18.2.0

## Usage

### Basic

```typescript
import { useMutation } from "@tanstack/react-query";
import { mutationOptions } from "@next-safe-action/adapter-tanstack-query";
import { createUserAction } from "./actions";

function CreateUserForm() {
  const { mutate, isPending, isError, error, data } = useMutation(
    mutationOptions(createUserAction)
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutate({ name: "John" }); }}>
      <button disabled={isPending}>Create User</button>
      {isError && error.serverError && <p>{error.serverError}</p>}
      {data && <p>Created: {data.name}</p>}
    </form>
  );
}
```

### With mutation options

Pass TanStack Query mutation options as the second argument — all options except `mutationFn` are accepted:

```typescript
const mutation = useMutation(mutationOptions(createUserAction, {
  onSuccess: (data) => {
    toast.success(`Created ${data.name}`);
    queryClient.invalidateQueries({ queryKey: ["users"] });
  },
  onError: (error) => {
    if (hasValidationErrors(error)) {
      showFieldErrors(error.validationErrors);
    } else {
      toast.error(`Server error: ${error.serverError}`);
    }
  },
  retry: (count, error) => {
    if (hasValidationErrors(error)) return false; // never retry validation errors
    return count < 3;
  },
}));
```

### With optimistic updates

```typescript
const mutation = useMutation(mutationOptions(toggleTodoAction, {
  onMutate: async (input) => {
    await queryClient.cancelQueries({ queryKey: ["todos"] });
    const previous = queryClient.getQueryData(["todos"]);
    queryClient.setQueryData(["todos"], (old) =>
      old.map((t) => t.id === input.id ? { ...t, done: !t.done } : t)
    );
    return { previous };
  },
  onError: (_error, _input, context) => {
    if (context?.previous) {
      queryClient.setQueryData(["todos"], context.previous);
    }
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["todos"] });
  },
}));
```

### With mutateAsync

```typescript
const { mutateAsync } = useMutation(mutationOptions(createUserAction));

async function handleSubmit(formData: FormData) {
  try {
    const user = await mutateAsync({ name: formData.get("name") as string });
    router.push(`/users/${user.id}`);
  } catch (error) {
    if (isActionMutationError(error) && hasValidationErrors(error)) {
      // handle validation errors
    }
  }
}
```

## Error handling

When a safe action returns `serverError` or `validationErrors`, the adapter throws an `ActionMutationError`. This means TanStack Query's `isError`, `error`, `failureCount`, and retry mechanism all work naturally:

- `isSuccess` is only `true` when the action succeeds without errors
- `isError` is `true` when the action has server or validation errors
- `error` is a typed `ActionMutationError` with `serverError` and `validationErrors` properties
- Retry logic can distinguish between error types using type guards

### ActionMutationError

```typescript
class ActionMutationError<ServerError, ShapedErrors> extends Error {
  readonly kind: "server" | "validation" | "both";
  readonly serverError?: ServerError;
  readonly validationErrors?: ShapedErrors;
}
```

### Type guards

```typescript
import {
  isActionMutationError,
  hasServerError,
  hasValidationErrors,
} from "@next-safe-action/adapter-tanstack-query";

// Check if an unknown error is an ActionMutationError
if (isActionMutationError(error)) {
  error.serverError;      // typed access
  error.validationErrors; // typed access
}

// Narrow to server errors
if (hasServerError(error)) {
  error.serverError; // guaranteed non-undefined
}

// Narrow to validation errors
if (hasValidationErrors(error)) {
  error.validationErrors; // guaranteed non-undefined
}
```

### Important: `throwValidationErrors` / `throwServerError` incompatibility

**Do not use `throwValidationErrors: true` or `throwServerError: true` on actions passed to `mutationOptions()`.**

React's Flight protocol serializes errors thrown in Server Actions across the server-client boundary. Custom error classes are converted to plain `Error` objects — all custom properties (like `validationErrors`) are lost, and `instanceof` checks fail. In production, even the error message is replaced with a generic string.

The adapter relies on the result envelope (the default behavior) to extract structured error data. When `throwValidationErrors` or `throwServerError` is enabled, errors are thrown on the server and lose all structured data before reaching the client.

### Navigation errors (redirect, notFound, etc.)

Server actions that call `redirect()`, `notFound()`, `forbidden()`, or `unauthorized()` throw framework-level navigation errors. The adapter automatically handles these by composing TanStack Query's `throwOnError` option to always re-throw navigation errors during React's render phase, allowing Next.js to catch them and perform the navigation.

This means navigation errors work transparently — if your action calls `redirect("/dashboard")`, the user will be redirected even when using this adapter. If you provide your own `throwOnError` option, the adapter composes it: navigation errors are always re-thrown, and your function handles everything else.

## API reference

### `mutationOptions(safeActionFn, opts?)`

Creates a complete `UseMutationOptions` object for use with `useMutation`.

**Parameters:**

- `safeActionFn` — A safe action function (the return value of `.action()` or bound with `.bind()`)
- `opts?` — Optional TanStack Query mutation options (all except `mutationFn`)

**Returns:** `UseMutationOptions<Data, ActionMutationError<ServerError, ShapedErrors>, Input, TOnMutateResult>`

### Type utilities

- `InferMutationOptions<T>` — Infer the `UseMutationOptions` type from a safe action function
- `InferActionMutationError<T>` — Infer the `ActionMutationError` type from a safe action function

## License

MIT
