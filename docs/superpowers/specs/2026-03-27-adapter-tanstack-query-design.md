# Design Spec: `@next-safe-action/adapter-tanstack-query`

## Context

TanStack Query adapter for next-safe-action is a highly requested feature. Server Actions are mutations in React, and TanStack Query's `useMutation` is the de facto standard for managing mutation state. This adapter bridges the two by providing a `mutationOptions()` factory function that creates a properly typed `UseMutationOptions` object, translating next-safe-action's error model into TanStack Query's error channel.

This adapter is **mutations-only** — no query support. Server Actions should not be used for data fetching (the React and Next.js teams recommend against it due to waterfall issues, lack of caching, and no deduplication).

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| API pattern | Options factory (`mutationOptions()`) | Avoids wrapper hook maintenance burden. tRPC v11 moved to this pattern after years of maintaining wrapper hooks. No TanStack Query option proxying needed. |
| Error model | Always throw `ActionMutationError` | Makes TanStack Query's `isError`/`error`/retry work naturally. Consistent with tRPC's approach. `isSuccess` only true on actual success. |
| Function name | `mutationOptions` | Short, matches TanStack Query's `queryOptions()` convention. Context clear from import path. |
| Entry points | Single (`.`) | No React hooks = no `"use client"` boundary needed. `mutationOptions` is a pure function. |
| Navigation errors | Export `isNavigationError` from core package | Clean, non-breaking, reusable. Adapter imports from `next-safe-action`. |

## Architecture

### Package Structure

```
packages/adapter-tanstack-query/
├── src/
│   ├── index.ts                          # mutationOptions factory + re-exports
│   ├── index.types.ts                    # All type definitions
│   ├── errors.ts                         # ActionMutationError class + type guards
│   ├── standard-schema.ts               # StandardSchemaV1 types (copied from RHF adapter)
│   └── __tests__/
│       ├── mutation-options.test.ts      # Factory function tests
│       ├── errors.test.ts               # Error class + type guard tests
│       └── types/
│           └── mutation-types.test-d.ts  # Type-level tests (vitest typecheck)
├── package.json
├── tsconfig.json
├── tsdown.config.ts
├── vitest.config.ts
├── .oxlintrc.json
└── README.md
```

### Public API Surface

```typescript
// From "@next-safe-action/adapter-tanstack-query"

// Factory function
function mutationOptions<ServerError, Schema, ShapedErrors, Data, TOnMutateResult>(
  safeActionFn: SingleInputActionFn<ServerError, Schema, ShapedErrors, Data>,
  opts?: Omit<UseMutationOptions<Data, ActionMutationError<ServerError, ShapedErrors>, Input, TOnMutateResult>, "mutationFn">
): UseMutationOptions<Data, ActionMutationError<ServerError, ShapedErrors>, Input, TOnMutateResult>;

// Error class
class ActionMutationError<ServerError, ShapedErrors> extends Error {
  readonly kind: "server" | "validation" | "both";
  readonly serverError?: ServerError;
  readonly validationErrors?: ShapedErrors;
}

// Type guards
function isActionMutationError(error: unknown): error is ActionMutationError<unknown, unknown>;
function hasServerError<SE, VE>(error: ActionMutationError<SE, VE>): error is ActionMutationError<SE, VE> & { serverError: SE; kind: "server" | "both" };
function hasValidationErrors<SE, VE>(error: ActionMutationError<SE, VE>): error is ActionMutationError<SE, VE> & { validationErrors: VE; kind: "validation" | "both" };

// Inference utilities
type InferMutationOptions<T extends Function, TOnMutateResult = unknown> = ...;
```

### Error Translation Flow

The `mutationFn` inside `mutationOptions` relies on the **result envelope** (the default behavior) for structured error data:

```
Safe Action called
  ├─ Action throws (unexpected or navigation error)
  │   ├─ Navigation error (redirect, notFound, etc.) → re-throw for Next.js
  │   └─ Any other thrown error → re-throw as-is for TanStack Query
  │
  └─ Action resolves with result (the reliable path)
      ├─ result.serverError or result.validationErrors present
      │   → throw new ActionMutationError({ serverError, validationErrors })
      └─ No errors → return result.data (TData)
```

### Critical: `throwValidationErrors` / `throwServerError` Incompatibility

**Users MUST NOT set `throwValidationErrors: true` or `throwServerError: true` on actions used with this adapter.**

React's Flight protocol serializes errors thrown in Server Actions across the server-client boundary. Custom error classes are converted to plain `Error` objects:
- `instanceof` checks for custom error classes **always fail** on the client
- Custom properties (like `.validationErrors`) are **completely lost**
- In production, even the error message is replaced with a generic string

This means errors thrown via `throwValidationErrors`/`throwServerError` lose all structured data before reaching the adapter's `mutationFn`. The adapter cannot recover validation errors or server errors from this path.

The result envelope (the default behavior, `throwValidationErrors: false`) is the **only reliable channel** for structured error data across the server-client boundary. This must be prominently documented in the README.

**Note:** Navigation errors (redirect, notFound, etc.) are unaffected because their `digest` property IS preserved by React's serialization, and `isNavigationError()` checks the `digest` pattern.

### Generic Type Mapping

| TanStack Query | Maps to | Source |
|---|---|---|
| `TData` | `Data` | Action's return type |
| `TError` | `ActionMutationError<ServerError, ShapedErrors>` | Always this type |
| `TVariables` | `InferInputOrDefault<Schema, void>` | Action's input schema |
| `TOnMutateResult` | User-specified (default `unknown`) | User's `onMutate` return |

### Prerequisite: Core Package Change

Export `isNavigationError` from the main `next-safe-action` entry point:

```typescript
// packages/next-safe-action/src/index.ts — additive, non-breaking
import { FrameworkErrorHandler } from "./next/errors";
export const isNavigationError = FrameworkErrorHandler.isNavigationError;
```

### Retry Behavior

- TanStack Query defaults to 0 retries for mutations (correct for our use case)
- Validation errors are deterministic — should never retry
- Server errors: user-controlled via TanStack Query's `retry` option
- Type guards enable clean retry configuration:

```typescript
useMutation(mutationOptions(myAction, {
  retry: (count, error) => {
    if (hasValidationErrors(error)) return false;
    return count < 3;
  },
}));
```

### Race Conditions

No custom request-ordering logic in the adapter. TanStack Query owns mutation state management:
- Each `mutate()` call creates a new mutation entry
- `scope.id` enables serial execution when needed
- The `variables` property always reflects the latest call

## Usage Examples

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
      <button disabled={isPending}>Create</button>
      {isError && error.serverError && <p>{error.serverError}</p>}
      {isError && error.validationErrors && <FieldErrors errors={error.validationErrors} />}
      {data && <p>Created user: {data.name}</p>}
    </form>
  );
}
```

### With Callbacks and Options

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
    if (hasValidationErrors(error)) return false;
    return count < 3;
  },
}));
```

### With mutateAsync

```typescript
const { mutateAsync } = useMutation(mutationOptions(createUserAction));

async function handleSubmit(data: FormData) {
  try {
    const result = await mutateAsync({ name: data.get("name") as string });
    router.push(`/users/${result.id}`);
  } catch (error) {
    if (isActionMutationError(error) && hasValidationErrors(error)) {
      // Handle validation errors
    }
  }
}
```

### With Optimistic Updates

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

## Dependencies

**Peer dependencies:**
- `@tanstack/react-query` >= 5.0.0
- `next` >= 14.0.0
- `next-safe-action` >= 8.1.10 (with `isNavigationError` export)
- `react` >= 18.2.0

**Dev dependencies:** All from pnpm catalog + `@tanstack/react-query` (needs to be added to catalog).

## Test Strategy

**errors.test.ts** — 12 test cases covering:
- ActionMutationError construction with server/validation/both errors
- kind derivation logic
- Error is instance of Error
- All 3 type guards with positive and negative cases

**mutation-options.test.ts** — 11 test cases covering:
- Returns object with mutationFn
- Passes through TanStack Query options
- mutationFn returns data on success
- mutationFn throws ActionMutationError on serverError, validationErrors, both
- mutationFn wraps ActionValidationError (throwValidationErrors path)
- mutationFn re-throws navigation errors untouched
- mutationFn re-throws unknown errors as-is
- User opts don't override mutationFn

**types/mutation-types.test-d.ts** — 10 type-level tests covering:
- TData, TVariables, TError inference from action
- Return type satisfies UseMutationOptions
- opts correctly omits mutationFn
- Callback types receive correct generics
- Actions with no schema produce void input
- InferMutationOptions utility type

## What This Adapter Does NOT Do

- **No query support** — Server Actions are not suitable for data fetching
- **No convenience hook** — Users call `useMutation()` directly with the factory output
- **No custom retry logic** — Users configure retry via TanStack Query's native options
- **No request ordering** — Delegated entirely to TanStack Query
- **No custom cache management** — Users use `queryClient` directly
