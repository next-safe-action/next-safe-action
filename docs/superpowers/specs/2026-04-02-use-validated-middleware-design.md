# `useValidated()` Post-Validation Middleware

## Context

Currently, all middleware in next-safe-action runs before input validation. The `use()` method appends middleware to a single `middlewareFns` array, and validation only happens at the terminal case of the recursive middleware stack. This means middleware cannot access typed, validated input data.

Users need post-validation middleware for use cases like: logging parsed input, enriching context based on validated user IDs, authorization checks that depend on input shape, and input-dependent rate limiting.

This design introduces `useValidated()`, a new builder method that adds middleware executed after input validation, with full type safety and compile-time guards against misuse.

## Requirements

1. `useValidated()` adds middleware that runs AFTER input validation
2. Validated middleware receives typed `parsedInput` (InferOutput), `clientInput` (InferInput), `bindArgsParsedInputs`, `bindArgsClientInputs`, `ctx`, `metadata`, and `next`
3. `useValidated()` can only be called when `inputSchema()` or `bindArgsSchemas()` was previously called (type error otherwise)
4. `inputSchema()` and `bindArgsSchemas()` cannot be called after `useValidated()` (type error otherwise)
5. `use()` can be called anywhere and always runs pre-validation
6. Include `createValidatedMiddleware()` standalone factory for reusable validated middleware

## Approach: Two Separate Middleware Arrays

### Why this approach

Three approaches were evaluated:

- **A (chosen): Two separate arrays** for pre-validation (`middlewareFns`) and post-validation (`validatedMiddlewareFns`). Clean two-phase execution, trivially correct `use()` behavior, follows existing patterns.
- **B: Single array with sentinel** marker. Mixed concerns, runtime sentinel checking on every iteration.
- **C: Validation index tracking**. Most complex, fragile index management, `use()` after `useValidated()` requires index shifting.

Approach A wins on runtime clarity, type safety, composability, error flow, and implementation complexity.

## New Type: `ValidatedMiddlewareFn`

Parameterized by **resolved types** (not schemas), so it works both inside `useValidated()` (schema-to-type conversion) and `createValidatedMiddleware()` (direct types):

```typescript
type ValidatedMiddlewareFn<
  ServerError,
  Metadata,
  Ctx extends object,
  NextCtx extends object,
  ParsedInput = unknown,
  ClientInput = unknown,
  BindArgsParsedInputs extends readonly unknown[] = readonly unknown[],
  BindArgsClientInputs extends readonly unknown[] = readonly unknown[],
> = {
  (opts: {
    parsedInput: ParsedInput;
    clientInput: ClientInput;
    bindArgsParsedInputs: BindArgsParsedInputs;
    bindArgsClientInputs: BindArgsClientInputs;
    ctx: Prettify<Ctx>;
    metadata: Metadata;
    next: {
      <NC extends object = {}>(opts?: { ctx?: NC }): Promise<MiddlewareResult<ServerError, NC>>;
    };
  }): Promise<MiddlewareResult<ServerError, NextCtx>>;
};
```

`useValidated()` converts schemas to types:
```typescript
ValidatedMiddlewareFn<
  ServerError, Metadata, Ctx, Ctx & NextCtx,
  InferOutputOrDefault<InputSchema, undefined>,  // parsedInput
  InferInputOrDefault<InputSchema, undefined>,   // clientInput
  InferOutputArray<BindArgsSchemas>,             // bindArgsParsedInputs
  InferInputArray<BindArgsSchemas>               // bindArgsClientInputs
>
```

## Type-Level Restrictions

### New generic parameter

Add `HasValidatedMiddleware extends boolean = false` as the 13th generic on `SafeActionClient`.

### Restriction 1: `useValidated()` requires prior schema

Uses the `this` parameter pattern (same as `action()` uses for `HasMetadata`):

```typescript
useValidated<NextCtx extends object>(
  this: InputSchemaFn extends undefined
    ? BindArgsSchemas extends readonly []
      ? never   // no schema at all: type error
      : SafeActionClient<...>  // bindArgsSchemas exists: OK
    : SafeActionClient<...>,   // inputSchema exists: OK
  middlewareFn: ValidatedMiddlewareFn<...>
)
```

### Restriction 2: `inputSchema()` and `bindArgsSchemas()` forbidden after `useValidated()`

```typescript
inputSchema<...>(
  this: HasValidatedMiddleware extends false
    ? SafeActionClient<...>  // no useValidated() yet: OK
    : never,                 // useValidated() called: type error
  ...
)

bindArgsSchemas<...>(
  this: HasValidatedMiddleware extends false
    ? SafeActionClient<...>
    : never,
  ...
)
```

### Chain validity table

| Chain | Result |
|---|---|
| `ac.useValidated(fn).inputSchema(...)` | Type error (no schema before useValidated) AND (schema after useValidated) |
| `ac.useValidated(fn).action(...)` | Type error (no schema before useValidated) |
| `ac.inputSchema(...).useValidated(fn).action(...)` | Compiles |
| `ac.inputSchema(...).useValidated(fn).use(fn2).action(...)` | Compiles |
| `ac.inputSchema(...).useValidated(fn).inputSchema(...)` | Type error (schema after useValidated) |
| `ac.bindArgsSchemas([...]).useValidated(fn).action(...)` | Compiles |
| `ac.use(fn1).inputSchema(...).useValidated(fn2).use(fn3).action(...)` | Compiles |

## Runtime Execution Model

Execution pipeline:

```
middlewareFns[0] -> middlewareFns[1] -> ... -> validateInputs()
  -> validatedMiddlewareFns[0] -> validatedMiddlewareFns[1] -> ... -> serverCode
```

### Changes to `action-builder.ts`

1. **Split `executeServerCode`**: extract the post-validation part into `runServerCode(parsedMainInput, parsedBindArgsInputs, ...)` that builds args, calls server code, validates output, updates middleware result.

2. **New `executeValidatedMiddlewareStack(idx, parsedMainInput, parsedBindArgsInputs)`**: recursive, same pattern as `executeMiddlewareStack`. Each validated middleware receives typed parsed inputs. Terminal case calls `runServerCode()`.

3. **Modified terminal case of `executeMiddlewareStack`**:
```typescript
} else {
  const validated = await validateInputs(
    mainClientInput, bindArgsClientInputs, currentCtx, middlewareResult
  );
  if (!validated) return;

  await executeValidatedMiddlewareStack(
    0, validated.parsedMainInput, validated.parsedBindArgsInputs
  );
}
```

### Error flow

Errors in validated middleware bubble up through `executeValidatedMiddlewareStack` catch, then through `executeMiddlewareStack` catch. Pre-validation middleware wrapping `next()` in try/catch can observe errors from validated middleware.

### Context flow

`currentCtx` is shared between both stacks. `use()` builds context, validation runs, `useValidated()` receives the same `currentCtx` and extends it further. Server code receives the final accumulated context.

### Zero overhead when unused

When `validatedMiddlewareFns` is empty (no `useValidated()` called), the validated stack immediately hits its terminal case and calls `runServerCode()`.

## `SafeActionClientArgs` Changes

Add to the args type:
```typescript
validatedMiddlewareFns: ValidatedMiddlewareFn<ServerError, any, any, any, any, any, any, any>[];
```

Initialize in `createSafeActionClient()`:
```typescript
validatedMiddlewareFns: []
```

## `createValidatedMiddleware()` Factory

Parallel to `createMiddleware()`, with additional type parameters for parsed/client inputs:

```typescript
export const createValidatedMiddleware = <
  BaseData extends {
    serverError?: any;
    ctx?: object;
    metadata?: any;
    parsedInput?: unknown;
    clientInput?: unknown;
    bindArgsParsedInputs?: readonly unknown[];
    bindArgsClientInputs?: readonly unknown[];
  }
>() => {
  return {
    define: <NextCtx extends object>(
      middlewareFn: ValidatedMiddlewareFn<
        BaseData extends { serverError: infer SE } ? SE : any,
        BaseData extends { metadata: infer Metadata } ? Metadata : any,
        BaseData extends { ctx: infer Ctx extends object } ? Ctx : object,
        NextCtx,
        BaseData extends { parsedInput: infer PI } ? PI : unknown,
        BaseData extends { clientInput: infer CI } ? CI : unknown,
        BaseData extends { bindArgsParsedInputs: infer BAPI extends readonly unknown[] }
          ? BAPI : readonly unknown[],
        BaseData extends { bindArgsClientInputs: infer BACI extends readonly unknown[] }
          ? BACI : readonly unknown[]
      >
    ) => middlewareFn,
  };
};
```

Usage:
```typescript
const logUser = createValidatedMiddleware<{
  parsedInput: { userId: string };
}>().define(async ({ parsedInput, next }) => {
  console.log("User:", parsedInput.userId);
  return next();
});

ac.inputSchema(z.object({ userId: z.string() }))
  .useValidated(logUser)
  .action(async ({ parsedInput }) => { ... });
```

## Implementation Note: Deprecated `schema` Alias

The deprecated `schema = this.inputSchema` property (line 161 in `safe-action-client.ts`) is a field assignment, not a method. It may not inherit the `this` constraint added to `inputSchema()`. This needs to be verified during implementation. If the `this` constraint doesn't propagate, the alias should be changed to a getter or method with its own `this` constraint, or the assignment should be updated to preserve the constraint.

## Files to Modify

| File | Change |
|---|---|
| `packages/next-safe-action/src/index.types.ts` | Add `ValidatedMiddlewareFn` type, add `HasValidatedMiddleware` generic to `SafeActionClientArgs`, add `validatedMiddlewareFns` to args, add `InferValidatedMiddlewareFnNextCtx` utility type |
| `packages/next-safe-action/src/safe-action-client.ts` | Add `HasValidatedMiddleware` generic, add `useValidated()` method, add `this` constraints on `inputSchema()` and `bindArgsSchemas()` |
| `packages/next-safe-action/src/action-builder.ts` | Split `executeServerCode` into `validateInputs` + `runServerCode`, add `executeValidatedMiddlewareStack`, modify terminal case |
| `packages/next-safe-action/src/middleware.ts` | Add `createValidatedMiddleware()` factory |
| `packages/next-safe-action/src/index.ts` | Export `createValidatedMiddleware`, `ValidatedMiddlewareFn` |

## Test Plan

### Runtime tests: `validated-middleware.test.ts` (~17 tests)

- Receives parsed input after validation
- Receives typed client input
- Receives bind args (parsed + client)
- Extends context via `next({ ctx })`
- `use()` runs before validated middleware
- `use()` after `useValidated()` still runs pre-validation
- Multiple `useValidated()` accumulate context in order
- Not called when main input validation fails
- Not called when bind args validation fails
- Receives correct parsed values after schema transforms
- Throws propagate as serverError
- Framework errors (redirect/notFound) propagate
- `next()` multiple times guard
- Not calling `next()` returns empty result
- Context from `use()` available in `useValidated()`
- Context from `useValidated()` available in server code
- `createValidatedMiddleware()` standalone middleware works and extends context

### Runtime edge case tests: `validated-middleware-edge-cases.test.ts` (~5 tests)

- No `useValidated()`: existing behavior unchanged (regression)
- With `outputSchema`: output validation still runs after server code
- With `returnValidationErrors()` inside validated middleware
- Metadata accessible in validated middleware
- Works with `stateAction()`

### Type tests: `types/validated-middleware.test-d.ts` (~12 tests)

- `useValidated()` compiles after `inputSchema()`
- `useValidated()` compiles after `bindArgsSchemas()`
- `useValidated()` errors without any schema
- `inputSchema()` errors after `useValidated()`
- `bindArgsSchemas()` errors after `useValidated()`
- `use()` works after `useValidated()`
- `parsedInput` type matches `InferOutput`
- `clientInput` type matches `InferInput`
- `bindArgsParsedInputs` type matches tuple
- Context accumulation across `use()` + `useValidated()`
- `createValidatedMiddleware()` type inference
- `createValidatedMiddleware()` composable with `useValidated()`

## Verification

1. Run `pnpm run test:lib` to verify all existing + new tests pass
2. Run `pnpm run lint:lib` to verify type checking passes
3. Manually verify the chain validity table entries compile/error as expected
4. Run `pnpm run build:lib` to verify the library builds correctly
