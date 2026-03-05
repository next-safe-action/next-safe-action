---
name: safe-action-hooks
description: Use when executing next-safe-action actions from React client components -- useAction, useOptimisticAction, handling status/callbacks (onSuccess/onError/onSettled), execute vs executeAsync, or optimistic UI updates
---

# next-safe-action React Hooks

## Import

```ts
// Standard hooks
import { useAction, useOptimisticAction } from "next-safe-action/hooks";

// Deprecated — use React's useActionState directly instead
import { useStateAction } from "next-safe-action/stateful-hooks";
```

## useAction — Quick Start

```tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { createUser } from "@/app/actions";

export function CreateUserForm() {
  const { execute, result, status, isExecuting, isPending } = useAction(createUser, {
    onSuccess: ({ data }) => {
      console.log("User created:", data);
    },
    onError: ({ error }) => {
      console.error("Failed:", error.serverError);
    },
  });

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      execute({ name: formData.get("name") as string });
    }}>
      <input name="name" required />
      <button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create User"}
      </button>
      {result.serverError && <p className="error">{result.serverError}</p>}
      {result.data && <p className="success">Created: {result.data.id}</p>}
    </form>
  );
}
```

## useOptimisticAction — Quick Start

```tsx
"use client";

import { useOptimisticAction } from "next-safe-action/hooks";
import { toggleTodo } from "@/app/actions";

export function TodoItem({ todo }: { todo: Todo }) {
  const { execute, optimisticState } = useOptimisticAction(toggleTodo, {
    currentState: todo,
    updateFn: (state, input) => ({
      ...state,
      completed: !state.completed,
    }),
  });

  return (
    <label>
      <input
        type="checkbox"
        checked={optimisticState.completed}
        onChange={() => execute({ todoId: todo.id })}
      />
      {todo.title}
    </label>
  );
}
```

## Return Value

Both `useAction` and `useOptimisticAction` return:

| Property | Type | Description |
|---|---|---|
| `execute(input)` | `(input) => void` | Fire-and-forget execution |
| `executeAsync(input)` | `(input) => Promise<Result>` | Returns a promise with the result |
| `input` | `Input \| undefined` | Last input passed to execute |
| `result` | `SafeActionResult` | Last action result (`{ data?, serverError?, validationErrors? }`) |
| `reset()` | `() => void` | Resets all state to initial values |
| `status` | `HookActionStatus` | Current status string |
| `isIdle` | `boolean` | No execution has started yet |
| `isExecuting` | `boolean` | Action promise is pending |
| `isTransitioning` | `boolean` | React transition is pending |
| `isPending` | `boolean` | `isExecuting \|\| isTransitioning` |
| `hasSucceeded` | `boolean` | Last execution returned data |
| `hasErrored` | `boolean` | Last execution had an error |
| `hasNavigated` | `boolean` | Last execution triggered a navigation |

`useOptimisticAction` additionally returns:
| `optimisticState` | `State` | The optimistically-updated state |

## Supporting Docs

- [execute vs executeAsync, result handling](./use-action.md)
- [Optimistic updates with useOptimisticAction](./optimistic-updates.md)
- [Status lifecycle and all callbacks](./status-callbacks.md)

## Anti-Patterns

```ts
// BAD: Using executeAsync without try/catch when navigation errors are possible
const handleClick = async () => {
  const result = await executeAsync({ id }); // Throws on redirect!
  showToast(result.data);
};

// GOOD: Wrap executeAsync in try/catch
const handleClick = async () => {
  try {
    const result = await executeAsync({ id });
    showToast(result.data);
  } catch (e) {
    // Navigation errors (redirect, notFound) are re-thrown
    // They'll be handled by Next.js — just let them propagate
    throw e;
  }
};
```
