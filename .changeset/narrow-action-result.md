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

### Breaking edge case for manual result construction

If you manually construct result objects in tests or mocks with more than one mutually exclusive field set (e.g. `{ data, serverError }` simultaneously), the new discriminated union will reject them at the type level. Such objects were already unreachable at runtime and should be split into separate test cases.
