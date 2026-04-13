---
"next-safe-action": minor
---

Narrow `SafeActionResult` into a discriminated union so that checking one field narrows the others to `undefined`.

Previously, `data`, `serverError`, and `validationErrors` were all independently optional on the result type, which meant TypeScript could not infer that they are mutually exclusive. Now:

```ts
const { data, serverError, validationErrors } = await myAction(input);

if (data) {
  // TypeScript knows serverError and validationErrors are undefined here
}

if (serverError) {
  // TypeScript knows data and validationErrors are undefined here
}
```

Destructured narrowing works end-to-end: checking any one of the three fields propagates to the other two. No hook API changes are required — `useAction().result` narrows automatically.

### Runtime behavior change (compound-error precedence)

To make narrowing honest, the action builder now applies a precedence rule when building the result, whereas previously it could return multiple populated fields at once in rare edge cases. The precedence is:

1. `validationErrors`
2. `serverError`
3. `data`

Two documented edge cases changed as a result:

- **Middleware calling `next()` twice.** Previously the result contained both the first call's `data` AND a `serverError` describing the second call. Now the result contains only the `serverError`. Calling `next()` twice is a programmer error, and returning partial data alongside the error was confusing.
- **Invalid bind args combined with invalid main input.** Previously the result contained both a `serverError` (wrapped bind args errors) AND `validationErrors` (main input). Now the result contains only the `validationErrors`. After the user fixes the main input and resubmits, the bind args errors will surface on the next attempt.

### Migration guide

These are the situations to check for after upgrading. All of them are rare in practice, and the fixes are mechanical. No changes are required for the typical `useAction()` / `await myAction(input)` consumer.

#### 1. Tests or mocks that assert on compound result objects

If you have tests that assert on a result containing more than one populated field (e.g. `{ data, serverError }` or `{ serverError, validationErrors }` simultaneously), they will fail, both because the discriminated union rejects them at the type level and because the runtime no longer produces them.

```ts
// Before
expect(result).toStrictEqual({
  serverError: "Invalid bind arg",
  validationErrors: { fieldErrors: { name: ["Required"] } },
});

// After: validation errors win, bind args error surfaces on the next attempt
expect(result).toStrictEqual({
  validationErrors: { fieldErrors: { name: ["Required"] } },
});
```

If you manually constructed `SafeActionResult` values in fixtures, split them into one object per branch (idle, success, server error, validation error).

#### 2. Exhaustive `switch` on `status` with a `"transitioning"` case

The `"transitioning"` value has been removed from the `HookActionStatus` union. It was never actually assigned at runtime, but if you had a `case "transitioning":` in an exhaustive `switch`, TypeScript will now complain that the case is unreachable.

```ts
// Before
switch (action.status) {
  case "idle": /* … */ break;
  case "executing": /* … */ break;
  case "transitioning": /* … */ break; // unreachable, delete this case
  case "hasSucceeded": /* … */ break;
  case "hasErrored": /* … */ break;
  case "hasNavigated": /* … */ break;
}
```

The `isTransitioning` boolean on the hook return object is unchanged. If you were relying on it for React transition state, nothing needs to change.

#### 3. Code that reshapes the hook return type

The return types of `useAction`, `useOptimisticAction`, and `useStateAction` are now discriminated unions keyed on `status`. Reading fields directly (`action.result.data`, `action.hasSucceeded`, etc.) works exactly as before. You only need to take action if you:

- Use `Pick`/`Omit`/`Partial` on `UseActionHookReturn` and expected a flat shape. These utilities now distribute over the union.
- Build custom wrappers that manually construct a value of type `UseActionHookReturn` (e.g. a test helper). The value must match exactly one branch of the union rather than the previous flat shape.

The `result` object on each branch is now narrowed — for example, on the `"hasSucceeded"` branch, `result.data` is typed as `Data` (not `Data | undefined`). This is strictly more information than before, and existing code that reads it without narrowing continues to compile.
