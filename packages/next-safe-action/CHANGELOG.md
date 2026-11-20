# next-safe-action

## 8.7.3

### Patch Changes

- [#485](https://github.com/next-safe-action/next-safe-action/pull/485) [`03661cb`](https://github.com/next-safe-action/next-safe-action/commit/03661cbeb4171d1d3267c3565a2560ebab451a8f) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - Fix `onNavigation` and `onSettled` firing twice for a single `redirect` in `useAction`, `useOptimisticAction` and `useStateAction`. The redirect is delivered on the first commit that carries it, before the status reaches `hasNavigated`, and the later `hasNavigated` commit re-fired the same navigation. Each navigation now fires the callbacks exactly once.

## 8.7.2

### Patch Changes

- [#483](https://github.com/next-safe-action/next-safe-action/pull/483) [`95a982e`](https://github.com/next-safe-action/next-safe-action/commit/95a982eb855d60f4f27c2034ba6a8f0492b3e991) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - fix(hooks): stop `useAction` and `useOptimisticAction` from leaking an unhandled promise rejection when the action call itself rejects (offline client, stale bundle after a deploy). The error still reaches the caller through `status`, `onError` with `thrownError`, and the `executeAsync` rejection. Closes [#482](https://github.com/next-safe-action/next-safe-action/issues/482).

## 8.7.1

### Patch Changes

- [#478](https://github.com/next-safe-action/next-safe-action/pull/478) [`e5f6522`](https://github.com/next-safe-action/next-safe-action/commit/e5f652232eec5adef2217c14ab9faabca148f255) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - Fix `reset()` letting the queued dispatches of `useStateAction` and `useOptimisticStateAction` write to the server after the user had discarded them.

  Both hooks queue dispatches through `useActionState`, and `reset()` marked every dispatch made before it as discarded: its result, its errors and its callbacks were all ignored when it settled. The dispatches themselves still ran, though, including the ones that were only _queued_ and had never contacted the server. So a `reset()` in the middle of a draining queue performed exactly the writes the user had just thrown away, and a `revalidatePath()` inside any of them pushed a fresh `currentState` that landed _after_ the reset, pulling the confirmed state into a value that was never on screen. With `useOptimisticStateAction` this reads as the list snapping to an order the user never chose, some seconds after resetting.

  A dispatch that a `reset()` marked stale before it took its turn in the queue now never calls the action at all: nothing had been sent for it, so the write is skipped, its `executeAsync` promise resolves with `{}`, and none of its callbacks fire. The dispatch that was already awaiting the server still completes, because React cannot recall it.

  Also fixed in `useOptimisticStateAction`: a `currentState` that committed while the queue was still draining applied the already-settled optimistic payloads a second time. React holds every payload for as long as the queue has work, and the hook relies on that to keep overlapping changes on screen, which is safe only while the confirmed base does not move. An urgent prop update moves it, and the settled payloads then folded on top of a base that already carried them (three queued appends over an acknowledged base rendered `["x", "x", "y", "z"]` instead of `["x", "y", "z"]`). Each payload now records its dispatch, and a prop that arrives mid-queue stops the payloads of dispatches that have already settled, while the pending ones keep folding. Next's own revalidation path is unaffected: it commits on the same suspended lane the queue waits on, so it never lands mid-queue.

  And a third fix in the same area: a `currentState` that committed while an action was still running discarded that action's own `data`, so the next queued dispatch built on its predecessor's predecessor and one write was silently overwritten (three queued appends over an acknowledging payload handed the third dispatch `{ data: ["x"] }` instead of `{ data: ["x", "y"] }`). Precedence between `currentState` and an action's `data` is now answered by arrival order for the value you render, as before, and by write order for the base the next queued dispatch sends to the server. A payload that commits while an action is running was rendered before that action wrote, so it is the older value there, whether it acknowledges the previous dispatch or carries an unrelated write. A payload that arrives once nothing is in flight still wins.

## 8.7.0

### Minor Changes

- [#473](https://github.com/next-safe-action/next-safe-action/pull/473) [`5e37200`](https://github.com/next-safe-action/next-safe-action/commit/5e372008a8f76250c88e5ad0d7977e9b1efd74c8) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - Add `useOptimisticStateAction`, the optimistic hook for stateful actions.

  `useOptimisticAction` is last-write-wins: when two executions overlap, the newer response is kept and the older discarded. That is correct for _replace_ semantics, but wrong when changes must accumulate, for example reordering an item and then reordering it again before the first save lands.

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
  - `currentState` is compared by identity, so pass a stable reference. A derived value (`items.filter(...)`) is a new identity on every render and breaks the same way an inline literal does.
  - When the action returns data, that data must be assignable to `State`. This is enforced at the type level, so an action returning some other shape is a compile error. Actions that return nothing are exempt, which is what the pending-changes-list shape relies on.
  - A `currentState` that commits while a dispatch is in flight supersedes that dispatch's return value, so a revalidated Server Component payload stays authoritative for everything queued behind it.
  - After `reset()`, the next change folds over the restored baseline instead of briefly re-showing the state that was just discarded.
  - Internal state is written after commit, never during render, so a render React starts and throws away (a Suspense retry, StrictMode's double invoke) cannot leak uncommitted state into the next dispatch.

  `useStateAction` is unchanged in behaviour; both hooks now share one internal implementation. That shared path also picks up three fixes:

  - A synchronous throw from a user callback no longer escapes before the dispatch is enqueued, which used to leave `executeAsync` pending forever.
  - A raw thrown error now settles the promises of dispatches queued behind it. React clears its whole action queue when an Action rejects, so those promises previously never resolved or rejected.
  - A throw from a dispatch that a `reset` already made stale no longer cancels fresh queued work.

## 8.6.1

### Patch Changes

- [#471](https://github.com/next-safe-action/next-safe-action/pull/471) [`fe95a4a`](https://github.com/next-safe-action/next-safe-action/commit/fe95a4a3761e4b5ea8d4a129b90f6a99ea381032) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - Fix hook state being frozen for the whole request when an action is dispatched from inside a React transition, most visibly with `<form action={execute}>`.

  React invokes a form action inside its own transition, so the state the hooks set at dispatch time (`isExecuting`, `isIdle`, `input`, cleared errors) inherited the transition lane. Next's router suspends on that same lane while it awaits the RSC response, and a render whose lanes are only transition lanes and that suspends is never committed. Everything scheduled at dispatch was therefore withheld until the action settled.

  The dispatch-time state is now also applied from a microtask, which runs after React has restored the current transition, so it lands on the default lane and commits immediately. Outside a transition the repeat is a no-op, so nothing changes on paths that already worked.

  What this fixes, for `<form action={execute}>` and any `execute` called inside a caller's own `startTransition`:

  - `isPending` and `isExecuting` stayed `false`, and `status` stayed `"idle"`, for the entire request. ([#470](https://github.com/next-safe-action/next-safe-action/issues/470))
  - `input` was not readable until the action settled.
  - `onExecute` never fired at all in `useAction`, and fired only after the action had already completed in `useOptimisticAction`.
  - In `useStateAction`, the dispatch immediately following a `reset()` reported nothing at all: `status` read `"idle"` with every shorthand flag `false` for the whole request. On the dispatches that did report, `onExecute` received a stale `input`, because React flips `useActionState`'s pending flag at sync priority, ahead of the dispatch state. `onExecute` now fires once per dispatch, on the first commit that carries the real input.

  Also fixed, found while verifying the above: a `useStateAction` whose action resolves `undefined` re-fired `onSuccess` and `onSettled` on every unrelated re-render. The result was normalized in the render body, so each render allocated a fresh object, and the callbacks use result identity to tell a new execution from a replay. It is now normalized where it is stored, matching `useAction`.

  `isPending`'s formula is unchanged, so a mid-flight `reset()` still reports idle immediately while the uncancellable transition settles. The `useAction` bugs above are not specific to 8.6.0: before 8.6.0 `isPending` happened to be `true` because it was derived from `isTransitioning` alone, which masked the underlying state machine rather than fixing it.

## 8.6.0

### Minor Changes

- [#466](https://github.com/next-safe-action/next-safe-action/pull/466) [`f3ff5ba`](https://github.com/next-safe-action/next-safe-action/commit/f3ff5ba8bbd4b3265ed32d609a005719576deed5) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - New features:

  - Added `returnServerError()` utility to return typed, expected server errors to the client as `result.serverError`, bypassing `handleServerError`. The payload is encoded onto the error `digest`, so it also works inside `"use cache"` scopes with `cacheComponents` enabled.
  - Added `initResult` option to `useAction` and `useOptimisticAction` (mirroring `useStateAction`), to seed the hook with an initial result before the first execution. The option is captured once at mount, like React's `useActionState` initial state, and `reset()` restores it. ([#427](https://github.com/next-safe-action/next-safe-action/issues/427))

  Fixes:

  - Output schema transforms and defaults are now applied to the returned `data` (and to the `onSuccess` callback). Previously the raw return value of the action was used even when the output schema transformed it, contradicting input validation semantics. If you use transforms in `outputSchema`, the returned data now reflects them.
  - `reset()` in `useAction`/`useOptimisticAction` now invalidates in-flight executions, so a pending response can no longer repopulate the hook state after a reset.
  - `useStateAction`'s `executeAsync` now supports overlapping invocations: each promise settles with its own execution result. Previously a second overlapping call overwrote the internal resolver, leaving the first promise unsettled and resolving the second with the wrong result.
  - `useStateAction`'s `reset()` now marks already-dispatched executions as stale: a dispatch queued before the reset can no longer clear the reset state, consume the `initResult` baseline meant for the next execution, or repopulate errors after the reset.
  - `reset()` now reports idle state immediately in all hooks: after a mid-flight reset, `status` and the `isPending`/`isExecuting` shorthands read idle even while the uncancellable in-flight execution is still settling. Previously `useStateAction` kept reporting `executing` and `useAction`/`useOptimisticAction` kept `isPending` true until the stale work settled.

## 8.5.5

### Patch Changes

- [#461](https://github.com/next-safe-action/next-safe-action/pull/461) [`77a81bb`](https://github.com/next-safe-action/next-safe-action/commit/77a81bb2bebb79ec1a62fa07b83b24e412609d7a) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - Harden validation-error building against prototype pollution. `buildValidationErrors` walks the (potentially client-controlled) Standard Schema issue paths to build the nested errors object: with a `record`/catchall schema, an input like `{"constructor":{"prototype":{...}}}` produced an issue path that walked the prototype chain and wrote to `Object.prototype`. Paths are now traversed with `Object.hasOwn` and written with own-property descriptors, so hostile keys (`__proto__`, `constructor`, `prototype`) are stored as plain own properties and can never reach the global prototype. As defense-in-depth, `flattenValidationErrors` assigns field keys the same safe way, the validation payload recovered from the error `digest` is parsed with a `__proto__`-stripping reviver, and `returnValidationErrors` now throws a clear error when given a non-JSON-serializable payload instead of leaking a raw `TypeError`.

- [#461](https://github.com/next-safe-action/next-safe-action/pull/461) [`77a81bb`](https://github.com/next-safe-action/next-safe-action/commit/77a81bb2bebb79ec1a62fa07b83b24e412609d7a) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - Fix `returnValidationErrors` being reported as a generic server error when called inside a Next.js `'use cache'` scope (`cacheComponents` enabled). Crossing the RSC boundary strips the thrown error's class identity, so the `instanceof` check failed and the client received `DEFAULT_SERVER_ERROR_MESSAGE` instead of the validation errors. The errors are now encoded on the error `digest` (the only channel Next.js preserves across the boundary, the same mechanism used to detect `redirect`/`notFound`) and correctly returned as `validationErrors`, matching the behavior when `cacheComponents` is disabled.

## 8.5.4

### Patch Changes

- [#455](https://github.com/next-safe-action/next-safe-action/pull/455) [`8ffa7f5`](https://github.com/next-safe-action/next-safe-action/commit/8ffa7f5338bd74270758c9857f3fb2e4a1c75cdf) Thanks [@LouisCuvelier](https://github.com/LouisCuvelier)! - Fix hook callbacks re-firing when a page is restored from the Next.js router bfcache (React `<Activity>`, enabled by `cacheComponents`): `onExecute`/`onSuccess`/`onError`/`onSettled`/`onNavigation` now fire once per action execution instead of replaying on every restore.

## 8.5.3

### Patch Changes

- [#450](https://github.com/next-safe-action/next-safe-action/pull/450) [`edf9dd6`](https://github.com/next-safe-action/next-safe-action/commit/edf9dd628027324166cfc9815689086f738cdb39) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - Remove the `deepmerge-ts` runtime dependency by inlining the small subset of deep-merge logic the library actually uses into an internal `deep-merge.ts`. Behavior is unchanged (records merged recursively, arrays concatenated, Sets/Maps combined, otherwise last value wins, with a `__proto__` pollution guard), and the package now ships with zero runtime dependencies.

## 8.5.2

### Patch Changes

- [#448](https://github.com/next-safe-action/next-safe-action/pull/448) [`c10b464`](https://github.com/next-safe-action/next-safe-action/commit/c10b46427739e08ef23b7c23d8c0c421382f4fb3) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - Add the pkg.pr.new badge to README. Documentation-only change, no runtime impact.

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

  Destructured narrowing works end-to-end: checking any one of the three fields propagates to the other two. No hook API changes are required: `useAction().result` narrows automatically.

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

  The `result` object on each branch is now narrowed: for example, on the `"hasSucceeded"` branch, `result.data` is typed as `Data` (not `Data | undefined`). This is strictly more information than before, and existing code that reads it without narrowing continues to compile.

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

  - `validateMetadata()`: metadata schema validation
  - `validateInputs()`: bind args + main input validation with early return on errors
  - `executeServerCode()`: server code execution with output validation
  - `handleExecutionError()`: error classification and handling

  #### Minor improvements

  - `FrameworkErrorHandler.getNavigationKind()`: simplified conditional chain, `getAccessFallbackHTTPStatus()` is now called once instead of three times.
  - `mapToHookFormErrors` (adapter): reversed the `_errors`/object check order with an early `continue` to avoid processing `_errors` keys as nested objects.

  #### New tests

  - `bind-args-validation-errors.test.ts`: bind args validation error handling
  - `hooks-race-conditions.test.tsx`: rapid execution race condition scenarios
  - `metadata.test.ts`: metadata schema validation
  - `middleware-edge-cases.test.ts`: middleware edge cases
  - `output-schema.test.ts`: output schema validation

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
