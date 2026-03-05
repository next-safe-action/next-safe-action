# Type Inference Utilities

## Available Types

All inference types are exported from `next-safe-action`:

```ts
import type {
  InferSafeActionFnInput,
  InferSafeActionFnResult,
  InferCtx,
  InferMetadata,
  InferServerError,
  InferMiddlewareFnNextCtx,
} from "next-safe-action";
```

## InferSafeActionFnInput

Infer the input types of an action function:

```ts
import type { InferSafeActionFnInput } from "next-safe-action";

const myAction = actionClient
  .inputSchema(z.object({ name: z.string(), age: z.number() }))
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ parsedInput }) => parsedInput);

type Input = InferSafeActionFnInput<typeof myAction>;
// {
//   clientInput: { name: string; age: number };
//   bindArgsClientInputs: [string];
//   parsedInput: { name: string; age: number };
//   bindArgsParsedInputs: [string];
// }
```

## InferSafeActionFnResult

Infer the result type of an action function:

```ts
import type { InferSafeActionFnResult } from "next-safe-action";

type Result = InferSafeActionFnResult<typeof myAction>;
// SafeActionResult<ServerError, Schema, CVE, Data>
// {
//   data?: { name: string; age: number };
//   serverError?: string;
//   validationErrors?: ValidationErrors<Schema>;
// }
```

## InferCtx

Infer the context type from a client or middleware:

```ts
import type { InferCtx } from "next-safe-action";

const authClient = actionClient.use(async ({ next }) => {
  return next({ ctx: { userId: "123", role: "admin" as const } });
});

type Ctx = InferCtx<typeof authClient>;
// { userId: string; role: "admin" }
```

## InferMetadata

Infer the metadata type from a client:

```ts
import type { InferMetadata } from "next-safe-action";

const client = createSafeActionClient({
  defineMetadataSchema: () => z.object({ actionName: z.string() }),
});

type MD = InferMetadata<typeof client>;
// { actionName: string }
```

## InferServerError

Infer the server error type:

```ts
import type { InferServerError } from "next-safe-action";

const client = createSafeActionClient({
  handleServerError: (e) => ({ message: e.message, code: "ERROR" as const }),
});

type SE = InferServerError<typeof client>;
// { message: string; code: "ERROR" }
```

## InferMiddlewareFnNextCtx

Infer the context a middleware passes to `next()`:

```ts
import type { InferMiddlewareFnNextCtx } from "next-safe-action";

const authMiddleware = createMiddleware().define(async ({ next }) => {
  return next({ ctx: { userId: "123" } });
});

type NextCtx = InferMiddlewareFnNextCtx<typeof authMiddleware>;
// { userId: string }
```

## Hook Return Type Inference

From `next-safe-action/hooks`:

```ts
import type {
  InferUseActionHookReturn,
  InferUseOptimisticActionHookReturn,
} from "next-safe-action/hooks";

type ActionReturn = InferUseActionHookReturn<typeof myAction>;
type OptimisticReturn = InferUseOptimisticActionHookReturn<typeof myAction, MyState>;
```

From `@next-safe-action/adapter-react-hook-form/hooks`:

```ts
import type {
  InferUseHookFormActionHookReturn,
  InferUseHookFormOptimisticActionHookReturn,
} from "@next-safe-action/adapter-react-hook-form/hooks";

type HFReturn = InferUseHookFormActionHookReturn<typeof myAction, FormContext>;
```

## Practical Use: Typed Wrapper Components

```tsx
import type { InferSafeActionFnResult } from "next-safe-action";

// Generic result display component
function ActionResult<T extends (...args: any[]) => any>({
  result,
}: {
  result: InferSafeActionFnResult<T>;
}) {
  if (result.serverError) return <div className="error">{result.serverError}</div>;
  if (result.data) return <div className="success">Success!</div>;
  return null;
}
```
