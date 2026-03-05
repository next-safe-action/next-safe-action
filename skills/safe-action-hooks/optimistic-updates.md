# Optimistic Updates

## useOptimisticAction

Wraps `React.useOptimistic` to immediately update the UI while the server action runs in the background.

```tsx
import { useOptimisticAction } from "next-safe-action/hooks";
```

### Required Props

```ts
useOptimisticAction(safeActionFn, {
  currentState: State,          // Current server state
  updateFn: (state, input) => State, // Produces the optimistic state
  // ...optional callbacks
});
```

- `currentState` — The current state from the server (typically from a Server Component prop or data fetch)
- `updateFn` — A pure function that computes the optimistic state from the current state and the action input

### How It Works

1. User calls `execute(input)`
2. `updateFn(currentState, input)` runs synchronously → `optimisticState` updates immediately
3. The action executes on the server
4. When the server responds, `currentState` prop updates via revalidation → `optimisticState` reverts to the real state

## Complete Example: Like Button

```tsx
"use client";

import { useOptimisticAction } from "next-safe-action/hooks";
import { toggleLike } from "@/app/actions";

interface Props {
  postId: string;
  likes: number;
  isLiked: boolean;
}

export function LikeButton({ postId, likes, isLiked }: Props) {
  const { execute, optimisticState } = useOptimisticAction(toggleLike, {
    currentState: { likes, isLiked },
    updateFn: (state) => ({
      likes: state.isLiked ? state.likes - 1 : state.likes + 1,
      isLiked: !state.isLiked,
    }),
    onError: ({ error }) => {
      // Optimistic state auto-reverts on error
      toast.error("Failed to update like");
    },
  });

  return (
    <button onClick={() => execute({ postId })}>
      {optimisticState.isLiked ? "❤️" : "🤍"} {optimisticState.likes}
    </button>
  );
}
```

## List Operations

### Optimistic Add

```tsx
const { execute, optimisticState } = useOptimisticAction(addTodo, {
  currentState: todos,
  updateFn: (state, input) => [
    ...state,
    { id: crypto.randomUUID(), title: input.title, completed: false },
  ],
});
```

### Optimistic Delete

```tsx
const { execute, optimisticState } = useOptimisticAction(deleteTodo, {
  currentState: todos,
  updateFn: (state, input) =>
    state.filter((todo) => todo.id !== input.todoId),
});
```

### Optimistic Update

```tsx
const { execute, optimisticState } = useOptimisticAction(toggleTodo, {
  currentState: todos,
  updateFn: (state, input) =>
    state.map((todo) =>
      todo.id === input.todoId
        ? { ...todo, completed: !todo.completed }
        : todo
    ),
});
```

## Key Points

- `optimisticState` updates **synchronously** before the server call
- When the server response arrives and `currentState` prop updates (via revalidation), the optimistic state is replaced by the real state
- On error, `optimisticState` automatically reverts to `currentState`
- The `updateFn` should be a **pure function** — no side effects
- `execute` and `executeAsync` both trigger the optimistic update
