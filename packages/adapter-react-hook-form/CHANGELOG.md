# @next-safe-action/adapter-react-hook-form

## 2.0.4

### Patch Changes

- [#417](https://github.com/next-safe-action/next-safe-action/pull/417) [`12d8f26`](https://github.com/next-safe-action/next-safe-action/commit/12d8f26ef691b23639ca31213c95b5ee8916abff) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - > [!IMPORTANT]

  > next-safe-action v8.1.9 or later is required for this adapter version due to internal code restructuring.

  ## Restructure internals for clarity and maintainability

  #### Hook deduplication

  `useHookFormAction` and `useHookFormOptimisticAction` shared identical form integration logic (error mapping, form setup, submit handler, reset). This has been extracted into a `useFormIntegration` internal helper. Both hooks now compose `useFormIntegration` with their respective action hooks.

  #### Type renames

  All generic parameter names updated to match the core library renames (`S` → `Schema`, `CVE` → `ShapedErrors`). The `HookSafeActionFn` import updated to `SingleInputActionFn`.

  #### New tests

  24 type tests across 2 files

  | File                          | Tests | Coverage                                                                                                                                                                                                                                                                                            |
  | ----------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `hook-return-types.test-d.ts` | 12    | `UseHookFormActionHookReturn` (action/form/handlers, action result types, shorthand status), `UseHookFormOptimisticActionHookReturn` (optimisticState, inherits form/handlers), `HookProps` (errorMapProps, formProps excludes resolver, FormContext default), custom server error flow-through     |
  | `infer-types.test-d.ts`       | 12    | `InferUseHookFormActionHookReturn` (extracts from `SafeActionFn`, result types, custom server error, custom FormContext, never for non-action), `InferUseHookFormOptimisticActionHookReturn` (optimisticState, form/handlers, custom server error + data, custom FormContext, never for non-action) |

- Updated dependencies [[`12d8f26`](https://github.com/next-safe-action/next-safe-action/commit/12d8f26ef691b23639ca31213c95b5ee8916abff)]:
  - next-safe-action@8.1.9

## 2.0.3

### Patch Changes

- [`3a10fa0`](https://github.com/next-safe-action/next-safe-action/commit/3a10fa06b9c2204630ffc31cf2d0c2bf5583d43a) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - fix broken example links in README

## 2.0.2

### Patch Changes

- [#412](https://github.com/next-safe-action/next-safe-action/pull/412) [`7bed4e5`](https://github.com/next-safe-action/next-safe-action/commit/7bed4e5b87d92e111b8be1cb460029f88bb24b1c) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - Update links for repo transfer

- Updated dependencies [[`7bed4e5`](https://github.com/next-safe-action/next-safe-action/commit/7bed4e5b87d92e111b8be1cb460029f88bb24b1c)]:
  - next-safe-action@8.1.7

## 2.0.1

### Patch Changes

- [#407](https://github.com/TheEdoRan/next-safe-action/pull/407) [`328a9be`](https://github.com/TheEdoRan/next-safe-action/commit/328a9be755b9629bd6baf0c7c442009eedbfeacd) Thanks [@TheEdoRan](https://github.com/TheEdoRan)! - improve internal code

- Updated dependencies [[`328a9be`](https://github.com/TheEdoRan/next-safe-action/commit/328a9be755b9629bd6baf0c7c442009eedbfeacd)]:
  - next-safe-action@8.1.6
