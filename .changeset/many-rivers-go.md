---
"next-safe-action": patch
---

## Restructure internals for clarity and maintainability

#### Type renames

All generic parameter names across exported types have been renamed from cryptic abbreviations to descriptive names:

| Before | After |
|---|---|
| `S` | `Schema` |
| `CVE` | `ShapedErrors` |
| `MD` | `Metadata` |
| `BAS` | `BindArgsSchemas` |
| `ODVES` | `ErrorsFormat` |
| `IS` | `InputSchema` |
| `ISF` | `InputSchemaFn` |
| `OS` | `OutputSchema` |
| `MDProvided` | `HasMetadata` |

The following exported type **names** have been renamed:

| Before | After |
|---|---|
| `DVES` | `ValidationErrorsFormat` |
| `SafeActionUtils` | `ActionCallbacks` |
| `StateServerCodeFn` | `StatefulServerCodeFn` |
| `HookSafeActionFn` | `SingleInputActionFn` |
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

| File | Tests | Coverage |
|---|---|---|
| `client-chain.test-d.ts` | 12 | Full generic chain: input/output schemas, bind args, schema transforms (input vs output types), custom server errors, flattened validation errors shape |
| `conditional-methods.test-d.ts` | 7 | `.action()`/`.stateAction()` gated behind `.metadata()` via `this` type constraint, metadata type validation |
| `middleware-ctx.test-d.ts` | 8 | Context accumulation through `.use()` chains (single, double, triple), previous context available in next middleware, metadata typing, `createMiddleware` standalone API |
| `schema-inference.test-d.ts` | 11 | `InferInputOrDefault`, `InferOutputOrDefault` (with/without schema, with transforms), `InferInputArray`/`InferOutputArray` (tuple preservation, empty tuples), `StandardSchemaV1.InferInput`/`InferOutput` |
| `validation-errors.test-d.ts` | 5 | `ValidationErrors` recursive mapping (simple objects, nested objects, undefined schema), `FlattenedValidationErrors` structure |
| `action-result.test-d.ts` | 7 | `InferSafeActionFnInput` (with/without schema, bind args extraction), `InferSafeActionFnResult` (from `SafeActionFn` and `SafeStateActionFn`), custom server error types, `SafeActionResult` shape |
| `hooks-return.test-d.ts` | 9 | `UseActionHookReturn` (execute signature, result types, shorthand status booleans), `UseOptimisticActionHookReturn` (optimisticState), `UseStateActionHookReturn` (omits executeAsync/reset), `InferUseActionHookReturn`, `InferUseOptimisticActionHookReturn`, `InferUseStateActionHookReturn` |
| `utility-types.test-d.ts` | 15 | `InferServerError` (from client, `SafeActionFn`, `SafeStateActionFn`, `MiddlewareFn`), `InferCtx` (from `MiddlewareFn`, from client with middleware), `InferMetadata` (from `MiddlewareFn`, from client with metadata schema), `InferMiddlewareFnNextCtx`, `Prettify`, never-fallback cases |