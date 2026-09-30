<div align="center">
  <img src="https://raw.githubusercontent.com/next-safe-action/next-safe-action/main/assets/logo.png" alt="next-safe-action logo" width="36" height="36">
  <a href="https://github.com/next-safe-action/next-safe-action/tree/main/packages/adapter-routes"><h1>adapter-routes</h1></a>
</div>

Expose selected [next-safe-action](https://github.com/next-safe-action/next-safe-action) actions as JSON API endpoints through a Next.js catch-all Route Handler, and optionally generate an OpenAPI 3.1 document for Scalar, Swagger UI, or Redoc. The same validated action keeps working with the React hooks.

Requires Next.js >= 15.1.0 and next-safe-action >= 8.8.0.

## Installation

```sh
npm i next-safe-action @next-safe-action/adapter-routes
```

## Quick start

```ts
// src/app/actions.ts
"use server";

import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";

export const createUser = createSafeActionClient()
	.inputSchema(z.object({ name: z.string().min(1) }))
	.action(async ({ parsedInput }) => ({ name: parsedInput.name }));
```

```ts
// src/lib/router.ts
import { createRouter } from "@next-safe-action/adapter-routes";
import { createUser } from "@/app/actions";

export const router = createRouter().post("/users", createUser, { successStatus: 201 });
```

```ts
// src/app/api/[[...path]]/route.ts
import { createRouteHandlers } from "@next-safe-action/adapter-routes";
import { router } from "@/lib/router";

export const { POST, PUT, PATCH, DELETE } = createRouteHandlers(router);
```

```sh
curl -X POST http://localhost:3000/api/users -H "Content-Type: application/json" -d '{"name":"Ada"}'
# 201 {"data":{"name":"Ada"}}
```

## Documentation

See the [route handlers documentation](https://next-safe-action.dev/docs/integrations/routes) for path parameters, `mapInput`, stateful actions, status codes, the security model, cross-origin calls, OpenAPI generation, and how to serve an API reference viewer.

## License

MIT
