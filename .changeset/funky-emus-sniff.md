---
"@next-safe-action/adapter-react-hook-form": patch
---

> [!IMPORTANT]
> next-safe-action v8.1.9 or later is required for this adapter version due to internal code restructuring.

#### Hook deduplication

`useHookFormAction` and `useHookFormOptimisticAction` shared identical form integration logic (error mapping, form setup, submit handler, reset). This has been extracted into a `useFormIntegration` internal helper. Both hooks now compose `useFormIntegration` with their respective action hooks.

#### Type renames

All generic parameter names updated to match the core library renames (`S` → `Schema`, `CVE` → `ShapedErrors`). The `HookSafeActionFn` import updated to `SingleInputActionFn`.

#### New tests

24 type tests across 2 files

| File | Tests | Coverage |
|---|---|---|
| `hook-return-types.test-d.ts` | 12 | `UseHookFormActionHookReturn` (action/form/handlers, action result types, shorthand status), `UseHookFormOptimisticActionHookReturn` (optimisticState, inherits form/handlers), `HookProps` (errorMapProps, formProps excludes resolver, FormContext default), custom server error flow-through |
| `infer-types.test-d.ts` | 12 | `InferUseHookFormActionHookReturn` (extracts from `SafeActionFn`, result types, custom server error, custom FormContext, never for non-action), `InferUseHookFormOptimisticActionHookReturn` (optimisticState, form/handlers, custom server error + data, custom FormContext, never for non-action) |