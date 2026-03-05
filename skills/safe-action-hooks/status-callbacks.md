# Status Lifecycle & Callbacks

## Status Lifecycle

```
idle → executing → hasSucceeded
                 → hasErrored
                 → hasNavigated
```

| Status | Meaning |
|---|---|
| `idle` | No execution has started (or `reset()` was called) |
| `executing` | Action promise is pending |
| `hasSucceeded` | Last execution returned `data` |
| `hasErrored` | Last execution had `serverError` or `validationErrors` |
| `hasNavigated` | Last execution triggered a navigation (redirect, notFound, etc.) |

## Shorthand Booleans

```ts
const {
  isIdle,          // status === "idle"
  isExecuting,     // status === "executing"
  isTransitioning, // React transition is still pending (after action resolves)
  isPending,       // isExecuting || isTransitioning
  hasSucceeded,    // status === "hasSucceeded"
  hasErrored,      // status === "hasErrored"
  hasNavigated,    // status === "hasNavigated"
} = useAction(myAction);
```

`isPending` is the most useful for disabling UI — it covers both the action execution and any React transition that follows.

## Callbacks

All callbacks are optional and receive typed arguments:

### onExecute

Fires immediately when `execute` or `executeAsync` is called.

```ts
useAction(myAction, {
  onExecute: ({ input }) => {
    console.log("Starting with input:", input);
  },
});
```

### onSuccess

Fires when the action returns data without errors.

```ts
useAction(myAction, {
  onSuccess: ({ data, input }) => {
    toast.success(`Created: ${data.name}`);
    router.refresh();
  },
});
```

### onError

Fires when the action has `serverError`, `validationErrors`, or throws.

```ts
useAction(myAction, {
  onError: ({ error, input }) => {
    // error.serverError    — from handleServerError
    // error.validationErrors — from schema validation / returnValidationErrors
    // error.thrownError    — non-navigation error thrown by executeAsync

    if (error.serverError) {
      toast.error(error.serverError);
    }
    if (error.validationErrors) {
      console.warn("Validation failed:", error.validationErrors);
    }
  },
});
```

### onNavigation

Fires when the action triggers a Next.js navigation error (redirect, notFound, forbidden, unauthorized).

```ts
useAction(myAction, {
  onNavigation: ({ input, navigationKind }) => {
    // navigationKind: "redirect" | "notFound" | "forbidden" | "unauthorized" | "other"
    console.log(`Navigation: ${navigationKind}`);
  },
});
```

### onSettled

Fires after any outcome (success, error, or navigation). Always runs.

```ts
useAction(myAction, {
  onSettled: ({ result, input, navigationKind }) => {
    // Good for cleanup, analytics, re-enabling UI
    setLoading(false);
  },
});
```

## Callback Execution Order

1. `onExecute` — immediately on execute
2. Action runs on server
3. One of: `onSuccess`, `onError`, or `onNavigation`
4. `onSettled` — always last

## Using Multiple Callbacks

```tsx
const { execute, isPending, result } = useAction(createPost, {
  onExecute: () => {
    setFormDisabled(true);
  },
  onSuccess: ({ data }) => {
    toast.success("Post created!");
    router.push(`/posts/${data.id}`);
  },
  onError: ({ error }) => {
    toast.error(error.serverError ?? "Failed to create post");
  },
  onSettled: () => {
    setFormDisabled(false);
  },
});
```
