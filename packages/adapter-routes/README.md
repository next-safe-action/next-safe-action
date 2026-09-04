<div align="center">
  <img src="https://raw.githubusercontent.com/next-safe-action/next-safe-action/main/assets/logo.png" alt="next-safe-action logo" width="36" height="36">
  <a href="https://github.com/next-safe-action/next-safe-action/packages/adapter-routes"><h1>adapter-routes</h1></a>
</div>

This adapter exposes selected [next-safe-action](https://github.com/next-safe-action/next-safe-action) actions as JSON mutation endpoints through Next.js Route Handlers, so the same validated action can serve React hooks and external API clients. It can also generate an OpenAPI 3.1 document for the exposed endpoints.

## Requirements

- Next.js >= `15.1.0`
- next-safe-action >= `8.8.0`

## Installation

```sh
npm i next-safe-action @next-safe-action/adapter-routes
```

## Quick start

### 1. Define an action with endpoint metadata

An action is exposed only when it uses `routesMiddleware`, declares `metadata.endpoint`, and is registered with the handlers. Add authentication middleware before `routesMiddleware`.

```ts
// src/app/api/actions.ts
"use server";

import { createSafeActionClient } from "next-safe-action";
import { routesMiddleware, type EndpointMetadata } from "@next-safe-action/adapter-routes";
import { z } from "zod";

const client = createSafeActionClient({
	defineMetadataSchema: () => z.object({ endpoint: z.custom<EndpointMetadata>().optional() }),
}).use(routesMiddleware());

export const createUser = client
	.metadata({ endpoint: { method: "POST", path: "/users", successStatus: 201 } })
	.inputSchema(z.object({ name: z.string().min(1) }))
	.outputSchema(z.object({ name: z.string() }))
	.action(async ({ parsedInput }) => parsedInput);
```

### 2. Create the catch-all route

```ts
// src/app/api/[[...path]]/route.ts
import { createRouteHandlers } from "@next-safe-action/adapter-routes";
import { createUser } from "../actions";

export const { POST, PUT, PATCH, DELETE, OPTIONS } = createRouteHandlers({
	actions: [createUser],
	// allowedOrigins: ["https://console.example.com"],
	// onError: (error) => console.error(error),
});
```

### 3. Call it

```sh
curl -X POST https://example.com/api/users \
  -H "content-type: application/json" \
  -d '{"name":"Ada"}'
# {"data":{"name":"Ada"}}
```

Validation failures return `400 { validationErrors }`, server errors return `{ serverError }`, and adapter failures return `{ httpError: { code, message } }`. Bodies are limited to 1 MiB by default, a JSON content type is required, and cross-origin browser requests must match `allowedOrigins`.

### Optional OpenAPI

Declare shared error schemas on the middleware, opt each endpoint in with `openapi`, then generate.

```ts
const client = createSafeActionClient({
	defineMetadataSchema: () => z.object({ endpoint: z.custom<EndpointMetadata>().optional() }),
}).use(
	routesMiddleware({
		openapiDefaults: { serverErrorSchema: { type: "string" }, validationErrorsSchema: { type: "object" } },
	})
);

export const createUser = client
	.metadata({ endpoint: { method: "POST", path: "/users", openapi: { operationId: "createUser" } } })
	.inputSchema(z.object({ name: z.string().min(1) }))
	.outputSchema(z.object({ name: z.string() }))
	.action(async ({ parsedInput }) => parsedInput);
```

```ts
import { generateOpenApiDocument } from "@next-safe-action/adapter-routes/openapi";

const document = generateOpenApiDocument({
	actions: [createUser],
	info: { title: "Users", version: "1.0.0" },
});
```

Only endpoints with `endpoint.openapi` are documented. Schemas are converted with Standard JSON Schema.

## Documentation

See the [route adapter documentation](https://next-safe-action.dev/docs/integrations/routes) for path templates, `mapInput`, stateful actions, the security model, CORS, and the complete OpenAPI configuration.

## License

MIT
