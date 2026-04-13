# next-safe-action

## 8.5.1

### Patch Changes

- [#446](https://github.com/next-safe-action/next-safe-action/pull/446) [`6b1e3f6`](https://github.com/next-safe-action/next-safe-action/commit/6b1e3f6ba1a2b80873baab8bf936b88b442246b2) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - Filter out undefined entries from the callback promises array before awaiting `Promise.all`, to satisfy the stricter `await-thenable` rule in the latest `oxlint-tsgolint`. No runtime behavior change.

## 8.5.0

### Minor Changes

- [#444](https://github.com/next-safe-action/next-safe-action/pull/444) [`adea4c6`](https://github.com/next-safe-action/next-safe-action/commit/adea4c6e695da5dc9b76a80fbe31cf885b5a4198) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - Narrow `SafeActionResult` into a discriminated union so that checking one field narrows the others to `undefined`.

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
    case "idle":
      /* … */ break;
    case "executing":
      /* … */ break;
    case "transitioning":
      /* … */ break; // unreachable, delete this case
    case "hasSucceeded":
      /* … */ break;
    case "hasErrored":
      /* … */ break;
    case "hasNavigated":
      /* … */ break;
  }
  ```

  The `isTransitioning` boolean on the hook return object is unchanged. If you were relying on it for React transition state, nothing needs to change.

  #### 3. Code that reshapes the hook return type

  The return types of `useAction`, `useOptimisticAction`, and `useStateAction` are now discriminated unions keyed on `status`. Reading fields directly (`action.result.data`, `action.hasSucceeded`, etc.) works exactly as before. You only need to take action if you:

  - Use `Pick`/`Omit`/`Partial` on `UseActionHookReturn` and expected a flat shape. These utilities now distribute over the union.
  - Build custom wrappers that manually construct a value of type `UseActionHookReturn` (e.g. a test helper). The value must match exactly one branch of the union rather than the previous flat shape.

  The `result` object on each branch is now narrowed — for example, on the `"hasSucceeded"` branch, `result.data` is typed as `Data` (not `Data | undefined`). This is strictly more information than before, and existing code that reads it without narrowing continues to compile.

## 8.4.0

### Minor Changes

- [#430](https://github.com/next-safe-action/next-safe-action/pull/430) [`9136b70`](https://github.com/next-safe-action/next-safe-action/commit/9136b70e5220063aeed315e66b93489ec6655e66) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - Add `useValidated()` post-validation middleware with type-safe context.

## 8.3.0

### Minor Changes

- [#423](https://github.com/next-safe-action/next-safe-action/pull/423) [`cdbaca5`](https://github.com/next-safe-action/next-safe-action/commit/cdbaca52f0aaeaef685cdc6d6694ff1d6a9d5912) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - Remove deprecation notice from `useStateAction` hook, and fix the code.

## 8.2.0

### Minor Changes

- [#421](https://github.com/next-safe-action/next-safe-action/pull/421) [`b94220e`](https://github.com/next-safe-action/next-safe-action/commit/b94220e53ab5d3a63f55e5a37f98cad8970dfd3d) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - Add `throwOnNavigation` flag to internal hooks, which defaults to false. When set to true, next/navigation functions such as `forbidden()` and `notFound()` will actually fire the navigation to an error page. `onNavigation` and `onSettled` callbacks can't be used in hooks when this flag is set to true, due to how Next.js and React handle navigations.

## 8.1.10

### Patch Changes

- [#419](https://github.com/next-safe-action/next-safe-action/pull/419) [`18cd6c1`](https://github.com/next-safe-action/next-safe-action/commit/18cd6c121597ae27d10b7000472b40fe4cac0e06) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - Export `isNavigationError`, `ThrowsErrorsBrand`, and `MaybeBrandThrows` from core package.

## 8.1.9

### Patch Changes

- [#417](https://github.com/next-safe-action/next-safe-action/pull/417) [`12d8f26`](https://github.com/next-safe-action/next-safe-action/commit/12d8f26ef691b23639ca31213c95b5ee8916abff) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - ## Restructure internals for clarity and maintainability

  #### Type renames

  All generic parameter names across exported types have been renamed from cryptic abbreviations to descriptive names:

  | Before       | After             |
  | ------------ | ----------------- |
  | `S`          | `Schema`          |
  | `CVE`        | `ShapedErrors`    |
  | `MD`         | `Metadata`        |
  | `BAS`        | `BindArgsSchemas` |
  | `ODVES`      | `ErrorsFormat`    |
  | `IS`         | `InputSchema`     |
  | `ISF`        | `InputSchemaFn`   |
  | `OS`         | `OutputSchema`    |
  | `MDProvided` | `HasMetadata`     |

  The following exported type **names** have been renamed:

  | Before                  | After                      |
  | ----------------------- | -------------------------- |
  | `DVES`                  | `ValidationErrorsFormat`   |
  | `SafeActionUtils`       | `ActionCallbacks`          |
  | `StateServerCodeFn`     | `StatefulServerCodeFn`     |
  | `HookSafeActionFn`      | `SingleInputActionFn`      |
  | `HookSafeStateActionFn` | `SingleInputStateActionFn` |

  Internal (non-exported) helper types were also renamed for clarity: `NotObject` → `PrimitiveOrArray`, `VEList` → `ValidationErrorNode`.

  #### Backward compatibility

  Deprecated type aliases have been added for all renamed exported types, so existing code that imports the old names will continue to work without changes. Each alias is marked with `@deprecated` and points to the new name:

  - `DVES` → `ValidationErrorsFormat`
  - `SafeActionUtils` → `ActionCallbacks`
  - `StateServerCodeFn` → `StatefulServerCodeFn`
  - `HookSafeActionFn` → `SingleInputActionFn`
  - `HookSafeStateActionFn` → `SingleInputStateActionFn`

  #### Hook deduplication

  `useAction` and `useOptimisticAction` shared ~200 lines of nearly identical state management, execution, and callback logic. This has been extracted into a shared `useActionBase` function in a new `hooks-shared.ts` module. Both hooks now delegate to `useActionBase`, with `useOptimisticAction` passing an `onTransitionStart` callback for its optimistic state update.

  #### Hook race condition fix

  `useActionBase` introduces a `requestIdRef` counter for request ordering. When `execute`/`executeAsync` is called rapidly, only the latest request's response updates UI state. Previously, a slow first request could overwrite the result of a faster second request. State updates before the transition are now set synchronously instead of via `setTimeout`.

  #### Action builder restructuring

  The monolithic `actionBuilder` function has been broken into focused helper functions:

  - `validateMetadata()` — metadata schema validation
  - `validateInputs()` — bind args + main input validation with early return on errors
  - `executeServerCode()` — server code execution with output validation
  - `handleExecutionError()` — error classification and handling

  #### Minor improvements

  - `FrameworkErrorHandler.getNavigationKind()` — simplified conditional chain, `getAccessFallbackHTTPStatus()` is now called once instead of three times.
  - `mapToHookFormErrors` (adapter) — reversed the `_errors`/object check order with an early `continue` to avoid processing `_errors` keys as nested objects.

  #### New tests

  - `bind-args-validation-errors.test.ts` — bind args validation error handling
  - `hooks-race-conditions.test.tsx` — rapid execution race condition scenarios
  - `metadata.test.ts` — metadata schema validation
  - `middleware-edge-cases.test.ts` — middleware edge cases
  - `output-schema.test.ts` — output schema validation

  74 type tests across 8 files

  | File                            | Tests | Coverage                                                                                                                                                                                                                                                                                        |
  | ------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `client-chain.test-d.ts`        | 12    | Full generic chain: input/output schemas, bind args, schema transforms (input vs output types), custom server errors, flattened validation errors shape                                                                                                                                         |
  | `conditional-methods.test-d.ts` | 7     | `.action()`/`.stateAction()` gated behind `.metadata()` via `this` type constraint, metadata type validation                                                                                                                                                                                    |
  | `middleware-ctx.test-d.ts`      | 8     | Context accumulation through `.use()` chains (single, double, triple), previous context available in next middleware, metadata typing, `createMiddleware` standalone API                                                                                                                        |
  | `schema-inference.test-d.ts`    | 11    | `InferInputOrDefault`, `InferOutputOrDefault` (with/without schema, with transforms), `InferInputArray`/`InferOutputArray` (tuple preservation, empty tuples), `StandardSchemaV1.InferInput`/`InferOutput`                                                                                      |
  | `validation-errors.test-d.ts`   | 5     | `ValidationErrors` recursive mapping (simple objects, nested objects, undefined schema), `FlattenedValidationErrors` structure                                                                                                                                                                  |
  | `action-result.test-d.ts`       | 7     | `InferSafeActionFnInput` (with/without schema, bind args extraction), `InferSafeActionFnResult` (from `SafeActionFn` and `SafeStateActionFn`), custom server error types, `SafeActionResult` shape                                                                                              |
  | `hooks-return.test-d.ts`        | 9     | `UseActionHookReturn` (execute signature, result types, shorthand status booleans), `UseOptimisticActionHookReturn` (optimisticState), `UseStateActionHookReturn` (omits executeAsync/reset), `InferUseActionHookReturn`, `InferUseOptimisticActionHookReturn`, `InferUseStateActionHookReturn` |
  | `utility-types.test-d.ts`       | 15    | `InferServerError` (from client, `SafeActionFn`, `SafeStateActionFn`, `MiddlewareFn`), `InferCtx` (from `MiddlewareFn`, from client with middleware), `InferMetadata` (from `MiddlewareFn`, from client with metadata schema), `InferMiddlewareFnNextCtx`, `Prettify`, never-fallback cases     |

## 8.1.8

### Patch Changes

- [`15a34d1`](https://github.com/next-safe-action/next-safe-action/commit/15a34d18f4d75d9961c5e17ad4ddbbb26502143e) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - Update website section in README

## 8.1.7

### Patch Changes

- [#412](https://github.com/next-safe-action/next-safe-action/pull/412) [`7bed4e5`](https://github.com/next-safe-action/next-safe-action/commit/7bed4e5b87d92e111b8be1cb460029f88bb24b1c) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - Update links for repo transfer

## 8.1.6

### Patch Changes

- [#407](https://github.com/TheEdoRan/next-safe-action/pull/407) [`328a9be`](https://github.com/TheEdoRan/next-safe-action/commit/328a9be755b9629bd6baf0c7c442009eedbfeacd) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - improve internal code
