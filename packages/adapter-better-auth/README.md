<div align="center">
  <img src="https://raw.githubusercontent.com/next-safe-action/next-safe-action/main/assets/logo.png" alt="next-safe-action logo" width="36" height="36">
  <a href="https://github.com/next-safe-action/next-safe-action/packages/adapter-better-auth"><h1>adapter-better-auth</h1></a>
</div>

This adapter offers a way to seamlessly integrate [next-safe-action](https://github.com/next-safe-action/next-safe-action) with [Better Auth](https://www.better-auth.com). It provides a `betterAuth()` function that fetches the session, blocks unauthenticated requests, and injects fully-typed `{ user, session }` data into the action context.

## Requirements

- Next.js >= `15.1.0`
- next-safe-action >= `8.4.0`
- better-auth >= `1.5.0`

## Installation

```sh
npm i next-safe-action better-auth @next-safe-action/adapter-better-auth
```

## Quick start

### 1. Set up Better Auth

Create your Better Auth server instance:

```ts
// src/lib/auth.ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
	// ...your config (database, plugins, etc.)
});
```

### 2. Create an authenticated action client

```ts
// src/lib/safe-action.ts
import { createSafeActionClient } from "next-safe-action";
import { betterAuth } from "@next-safe-action/adapter-better-auth";
import { auth } from "./auth";

export const actionClient = createSafeActionClient();

export const authClient = actionClient.use(betterAuth(auth));
```

### 3. Use it in your actions

```ts
// src/app/actions.ts
"use server";

import { z } from "zod";
import { authClient } from "@/lib/safe-action";

export const updateProfile = authClient
	.inputSchema(z.object({ name: z.string().min(1) }))
	.action(async ({ parsedInput, ctx }) => {
		// ctx.auth.user and ctx.auth.session are fully typed
		const userId = ctx.auth.user.id;

		await db.user.update({
			where: { id: userId },
			data: { name: parsedInput.name },
		});

		return { success: true };
	});
```

## How it works

`betterAuth()` creates a pre-validation middleware for the safe action client's `.use()` chain:

1. **Fetches the session** by calling `auth.api.getSession({ headers: await headers() })`
2. **Blocks unauthenticated requests** by calling `unauthorized()` from `next/navigation` when no session exists
3. **Injects typed context** by passing `{ auth: { user, session } }` to `next()`, merging it into the action context

### `unauthorized()` and auth interrupts

The default behavior uses `unauthorized()` from `next/navigation`, which requires `experimental.authInterrupts` in your Next.js configuration:

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	experimental: {
		authInterrupts: true,
	},
};

export default nextConfig;
```

## Custom authorization

Pass an `authorize` callback to customize the authorization flow. The session is pre-fetched and passed to the callback:

```ts
import { unauthorized } from "next/navigation";
import { betterAuth } from "@next-safe-action/adapter-better-auth";
import { auth } from "./auth";

// Role-based access
export const adminClient = actionClient.use(
	betterAuth(auth, {
		authorize: ({ authData, next }) => {
			if (!authData || authData.user.role !== "admin") {
				unauthorized();
			}
			return next({ ctx: { auth: authData } });
		},
	})
);
```

### `authorize` callback parameters

- `auth`: the Better Auth server instance
- `authData`: the pre-fetched session data (`{ user, session } | null`)
- `ctx`: the current action context from preceding middleware
- `next`: call this to continue the middleware chain, pass `{ ctx }` to inject context

## Server Action cookies

If your actions call Better Auth functions that set cookies (e.g. `signInEmail`, `signUpEmail`), add the `nextCookies()` plugin to your Better Auth instance. Refer to the [Better Auth documentation](https://better-auth.com/docs/integrations/next#server-action-cookies) for more details.

```ts
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
	// ...your config
	plugins: [
		// ...other plugins
		nextCookies(), // must be the last plugin in the array
	],
});
```

## API reference

### `betterAuth(auth, opts?)`

Creates a middleware function for use with the safe action client's `.use()` method.

**Parameters:**

- `auth`: the Better Auth server instance (return value of `betterAuth()`)
- `opts?`: optional object with an `authorize` callback for custom authorization logic

**Returns:** a middleware function compatible with `.use()`

### Exported types

- `BetterAuthContext<Options>`: the context shape added by the middleware (`{ auth: { user, session } }`)
- `AuthorizeFn<Options, NextCtx>`: the `authorize` callback signature
- `BetterAuthOpts<Options, NextCtx>`: the options object type for `betterAuth`

## Documentation

For full documentation, visit [next-safe-action.dev/docs/integrations/better-auth](https://next-safe-action.dev/docs/integrations/better-auth).

## License

MIT
