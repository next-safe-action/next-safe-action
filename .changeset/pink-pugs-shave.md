---
"next-safe-action": minor
---

Add `useOptimisticStateAction`, the optimistic hook for stateful actions.

`useOptimisticAction` is last-write-wins: when two executions overlap, the newer response is kept and the older discarded. That is correct for *replace* semantics, but wrong when changes must accumulate, for example reordering an item and then reordering it again before the first save lands.

`useOptimisticStateAction` is built on React's `useActionState`, so dispatches are queued: each waits for the previous to settle and receives its result as `prevResult`.

```tsx
const { optimisticState, execute } = useOptimisticStateAction(saveLayout, {
	currentState: groups,
	updateFn: layoutReducer,
});
```

Confirmed state is the more recent of the action's successful `data` and the `currentState` option, which covers both shapes of the pattern: an action that returns the full next state owns the confirmed value, an action that returns nothing leaves `currentState` authoritative, and a revalidated `currentState` beats a stale client-side fold.

Details worth knowing:

- Confirmed domain state is tracked separately from the `SafeActionResult` envelope, so a validation or server error rolls back to the last confirmed value instead of blanking the UI.
- `prevResult` handed to the server always carries a `data` branch: after a failed dispatch the hook substitutes the last confirmed state, so one rejected write cannot leave the rest of the queue without a base.
- Callbacks are delivered per dispatch rather than from a render effect, because React withholds `useActionState`'s commit until the whole queue drains and `result`/`status` cannot report intermediate results. They fire just before commit rather than after.
- `currentState` is compared by identity, so pass a stable reference.

`useStateAction` is unchanged; both hooks now share one internal implementation.
