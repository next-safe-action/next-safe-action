# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Overview

next-safe-action is a TypeScript library for type-safe, validated Next.js Server Actions. It provides a chainable client API with middleware, input/output validation (via Standard Schema v1, Zod, Yup, etc.), and React hooks for client-side consumption.

## Monorepo Structure

- **`packages/next-safe-action`**: the core library (source in `src/`, tests in `src/__tests__/`)
- **`packages/adapter-react-hook-form`**: `@next-safe-action/adapter-react-hook-form` adapter for seamless react-hook-form integration
- **`packages/adapter-tanstack-query`**: `@next-safe-action/adapter-tanstack-query` adapter for TanStack Query mutation integration
- **`packages/adapter-better-auth`**: `@next-safe-action/adapter-better-auth` adapter for Better Auth session middleware integration
- **`packages/codemod`**: `@next-safe-action/codemod` CLI (`npx @next-safe-action/codemod v9`) that migrates user projects between major versions
- **`apps/playground`**: Next.js app for manual testing (Tailwind v4, shadcn/ui, Shiki code viewer)
- **`apps/docs`**: Fumadocs documentation site (content in `content/docs/`, MDX)

## Technology Stack

| Category | Technology | Version |
|---|---|---|
| Language | TypeScript (native `tsgo` compiler, no JS API or tsserver) | ~7.0.2 |
| Runtime | Node.js | >=18.18 for the published packages; ^22.18.0, ^24.11.0 or >=26 for development (`.node-version`: 24) |
| Package manager | pnpm (with catalogs) | 11.28.5 |
| Framework | Next.js | ^16.3.8 |
| UI library | React | ^19.3.0 |
| Monorepo orchestration | Turborepo | ^2.11.7 |
| Bundler | tsdown (Rolldown + Oxc) | ^0.23.0 |
| Test framework | Vitest | ^5.0.3 |
| Browser test framework | Playwright (Chromium) | 1.63.0 |
| Formatter | Oxfmt | ^0.72.0 |
| Linter | Oxlint (type-aware, oxlint-tsgolint ^7.0.2003) | 1.87.0 |
| Validation | Zod ^4.6.5, Yup ^1.7.1 (Standard Schema v1) | - |
| CSS framework | Tailwind CSS v4 | ^4 |
| Component library | shadcn/ui (Radix UI + CVA) | ^4.21.3 |
| Docs framework | Fumadocs (core + UI / MDX) | ^16.16.2 / ^15.4.6 |
| Forms | react-hook-form + @hookform/resolvers | ^7.89.0 / ^5.9.1 |
| Data fetching | TanStack Query (React Query) | ^5.104.1 |
| Versioning | Changesets (CLI, `changesets/action` v2 in the release workflow) | ^3.0.3 |

## Commands

All commands run from the repository root unless noted.

| Task | Command |
|---|---|
| Install dependencies | `pnpm install` |
| Build library | `pnpm run build:lib` |
| Build all libraries | `pnpm run build:lib` |
| Build + start playground | `pnpm run build:lib && pnpm run pg` |
| Start docs dev server | `pnpm run docs` |
| Build docs | `pnpm run build:docs` |
| Lint library | `pnpm run lint:lib` |
| Lint all libraries | `pnpm run lint:lib` |
| Lint docs | `pnpm run lint:docs` |
| Lint playground | `pnpm run lint:pg` |
| Test library | `pnpm run test:lib` |
| Test all libraries | `pnpm run test:lib` |
| Test playground browser flows | `pnpm run test:pg` |
| Run playground E2E without rebuilding | `cd apps/playground && pnpm run test:e2e` |
| Run single test | `cd packages/next-safe-action && npx vitest run ./src/__tests__/<file>.test.ts` |
| Format all files | `pnpm run fmt` |
| Check formatting | `pnpm run fmt:check` |
| Create changeset | `pnpm run changeset` |
| Empty changeset (no bump) | `pnpm run changeset:empty` |

## Code Style

- **Formatter**: Oxfmt, tabs (tabWidth 2), printWidth 120, semicolons, double quotes, trailing commas (es5), import sorting, Tailwind CSS class sorting. Config in `.oxfmtrc.json`.
- **Linter**: Oxlint with type-aware checking via `oxlint-tsgolint`. Shared base config in `.oxlintrc.base.json`, package overrides in per-package `.oxlintrc.json`. Plugins: oxc, eslint, unicorn, typescript, react, react-perf (library packages), plus nextjs (app packages). The React Compiler rule `react/refs` is off in the core package, because the hooks read refs during render on purpose (see the hook architecture notes below); the playground only exempts its shadcn-generated files and two request-time Server Components.
- **TypeScript**: strict mode with `noUncheckedIndexedAccess`. Library lint runs `tsc --noEmit && oxlint --type-aware .`. The catalog pins TypeScript with a tilde (`~7.0.2`) because tsdown's dts generator (`rolldown-plugin-dts`, peer `~7.0.0`) only supports the native compiler for 7.0.x; widen it once 7.1 is supported.
- Prefer explicit type imports/exports (enforced by Oxlint).
- **CSS**: Tailwind v4 with CSS-first configuration (no tailwind.config file), PostCSS via `@tailwindcss/postcss`.
- **Punctuation**: Never use em dashes. Use commas, colons, or other appropriate punctuation instead.

## Architecture

The library has four entry points: `next-safe-action` (server), `next-safe-action/hooks` (client), plus `next-safe-action/routes` (JSON mutation route handlers) and its optional `next-safe-action/routes/openapi` (OpenAPI 3.1 generation). The RHF adapter has two: `@next-safe-action/adapter-react-hook-form` and `@next-safe-action/adapter-react-hook-form/hooks`. The TanStack Query adapter has one: `@next-safe-action/adapter-tanstack-query`. The Better Auth adapter has one: `@next-safe-action/adapter-better-auth`. The codemod package has no library entry, only the `next-safe-action-codemod` bin.

**Server-side core:**
- `safe-action-client.ts`: `SafeActionClient` class with chainable methods: `use()` (middleware), `metadata()`, `inputSchema()`, `outputSchema()`, `bindArgsSchema()`, `action()`, `stateAction()`
- `action-builder.ts`: core execution engine: runs the middleware stack, validates input/output via Standard Schema, handles errors
- `deep-merge.ts`: dependency-free `deepmerge()` used to merge middleware context objects (inlined from `deepmerge-ts` to keep the package free of runtime dependencies)
- `middleware.ts`: `createMiddleware()` and `createValidatedMiddleware()` for standalone middleware definitions
- `action-definition.ts`: internal `getActionDefinition()` (used by the routes entry, not exported publicly) reads the frozen, read-only `ActionDefinition` that `action()`/`stateAction()` attach to every action under a non-enumerable `Symbol.for` key (so duplicate core copies interoperate). Direct input schemas are retained separately from factories; factories are never executed to build it. Bound actions have no definition.
- `inspectFrameworkError()` (in `next/errors/`, internal): narrow inspector, used by the routes entry, reusing the existing framework parsers for redirects, HTTP access statuses, and other control-flow signals.
- `validation-errors.ts`: error formatting and flattening utilities
- `server-error.ts`: `returnServerError()` for typed, expected server errors that bypass `handleServerError` (digest-encoded to survive `"use cache"` boundaries)
- `utils.ts`: utility constants (`DEFAULT_SERVER_ERROR_MESSAGE`) and helpers
- `standard-schema.ts`: Standard Schema v1 interface definitions and type utilities for schema inference
- `next/errors/`: `FrameworkErrorHandler` class plus `inspectFrameworkError()`. `isNavigationError` mirrors the set that Next.js `unstable_rethrow()` re-throws (without walking `error.cause`): redirect and HTTP access fallback (404/403/401) errors (`redirect.ts`, `http-access-fallback.ts`), React postpone and the PPR `ppr-caught-error` message (`postpone.ts`, still produced by Next 15.x with `experimental.ppr`), and plain digest signals (`BAILOUT_TO_CLIENT_SIDE_RENDERING`, `DYNAMIC_SERVER_USAGE`, `HANGING_PROMISE_REJECTION`, `NEXT_PRERENDER_INTERRUPTED`) in `index.ts`. All of them are re-thrown to the framework with navigation kind `"other"` unless they are redirects or access errors. Every check keeps a comment pointing at the Next.js source it mirrors.

**Client-side hooks:**
- `hooks.ts`: all four client hooks: `useAction`, `useOptimisticAction`, `useStateAction`, and `useOptimisticStateAction`
- `hooks-shared.ts`: base hook logic (`useActionBase`) shared by `useAction` and `useOptimisticAction`, including the `onTransitionStart` seam that lets the optimistic hook dispatch inside the action's transition. The seam is read directly and listed in the callback deps (never mirrored into a ref during render); its only caller passes the stable `useOptimistic` dispatcher. The `startTransition` callback deliberately does not return the promise chain (React would otherwise own it: `isTransitioning` for the whole request, optimistic value pinned to it, rejected requests thrown into the error boundary), and it never re-throws inside `.catch`, since that only produces an unhandled rejection nobody can catch. Errors reach the caller through hook state, the callbacks, and the `executeAsync` rejection.
- `hooks-utils.ts`: shared hook utilities (`getActionStatus`, `getActionShorthandStatusObject`, `useActionCallbacks`)
- `useStateActionInternal` (private, in `hooks.ts`): shared implementation behind `useStateAction` and `useOptimisticStateAction`, wrapping React's `useActionState`. Owns the stateful path's concurrency invariants (FIFO resolver queue, reset generations, ambient-transition double-apply, pending-flag masking, dropping post-`reset` queued dispatches before they reach the server) and exposes them through optional `strategies` seams (`onTransitionStart`, `resolvePrevResult`, `onDispatchSettled`, `onReset`, `suppressCallbacks`). Extend via those seams rather than by copying the hook. `strategies` is read directly and listed in the callback deps, never mirrored into a ref during render, so a caller must pass a stable object (`useOptimisticStateAction` builds it with `useMemo(..., [])`). `onReset` receives the authoritative reset generation: a consumer must never derive its own from rendered state, because two `reset()` calls batched into one event advance the internal counter twice. A raw throw drains and rejects every queued resolver before rethrowing, since React clears its whole action queue when an Action rejects; a throw from a dispatch that a `reset` already made stale returns `{}` instead of rethrowing, so it cannot cancel fresh queued work. A dispatch that a `reset` marked stale *before* it took its turn in the queue never calls the action at all: nothing was sent yet, so the write is skipped (its `executeAsync` promise resolves with `{}`). Only the dispatch already awaiting the server survives a `reset`, because that one cannot be recalled.
- `useOptimisticStateAction` keeps confirmed **domain** state separate from the `SafeActionResult` envelope: the envelope is a discriminated union, so `result.data` is `undefined` on every error branch. Two distinct "last confirmed" values are tracked on purpose, one derived from the committed result (what the user sees, advances only when the queue drains, so payloads can't double-apply) and one advanced at dispatch time (what the server gets as `prevResult`). `ActionDataFitsState` constrains the call site so `Data` must be assignable to `State` unless the action returns nothing, which makes the internal `data -> State` cast sound. Refs are never written during render (an abandoned concurrent render would leak uncommitted state into the next dispatch); the confirmed value is derived purely and the writes happen in a layout effect. An optimistic payload folds only while its dispatch is still pending, which is React's own `useOptimistic` rule: the hook keeps payloads alive across the whole queue because the visible base normally does not advance until the queue drains, so a `currentState` that commits mid-queue would leave the settled payloads folding on top of a base that already carries them. Each payload therefore records its dispatch id, and a mid-queue prop raises a cut to whatever had settled when it arrived. The whole payload model rests on one React behavior that this hook cannot enforce: React withholds the `useActionState` commit until the queue drains, so the base cannot move under the attached payloads except through an urgent update. That assumption is pinned by the `React withholds the committed result until the whole queue drains` canary test; if it ever fails, the settled payloads double-apply through `result` instead of through a prop. Precedence between `currentState` and an action's `data` is answered twice: by arrival for the rendered value, and by write order for `lastServerDataRef`, the base the next queued dispatch sends to the server. Arrival order alone is wrong for the server base, because a payload that commits while an action runs was rendered before that action wrote; ordering settles it with no bookkeeping, since `onDispatchSettled` runs after the layout effect exactly when the payload predates the write, and before it otherwise.

**Type system:**
- `index.types.ts`: core types with full generic inference for schemas, middleware context, and action results
- `hooks.types.ts`, `utils.types.ts`, `validation-errors.types.ts`: supporting type definitions

**Build & distribution:**
- ESM-only output (`.mjs` + `.d.mts`) via tsdown
- pnpm catalogs in `pnpm-workspace.yaml` centralize shared dependency versions
- Turborepo orchestrates build/test/lint tasks with dependency-aware caching

## Route handlers

The source lives in `packages/next-safe-action/src/routes/` (`index.ts`, `router.ts`, `types.ts`, `openapi.ts`), built as the `routes` and `routes/openapi` tsdown entries; it imports from the defining core modules, never from `../index`. Actions stay ordinary actions: `createRouter()` returns an immutable router whose `.post()`/`.put()`/`.patch()`/`.delete()` map an action to a path, and the same router feeds `createRouteHandlers(router, options)` and `generateOpenApiDocument(router, options)`. Only routed actions are exposed; there is no global registry. `createRouter({ prefix })` joins the prefix to every route path at add time (the route `/` maps to the prefix itself), and config types are derived from the joined path, so prefix parameters are typed and require `mapInput`. `mergeRouters(...routers)` concatenates the compiled routes into a new unprefixed router with the usual conflict checks; prefixes never nest. Since a prefix with parameters makes `Router<Prefix>` not assignable to `Router`, consumers (`mergeRouters`, `createRouteHandlers`, `generateOpenApiDocument`) accept `Pick<Router, "routes">`. The router reads each action's `getActionDefinition()` and validates every route when it is added (non-actions, bound actions, bind args, bad paths or statuses, duplicate or ambiguous templates, and stateful actions without `stateSchema` throw). Route config types are derived from the action and the path literal: `params` is typed from `{param}` segments, `mapInput` is required when the path has parameters and must return the action input, `stateSchema` is required only for stateful actions, and `serverErrorStatus` receives the action's server error type. Path templates with parameters require `mapInput`, the only way parameters reach the action. The handler exports only `POST`/`PUT`/`PATCH`/`DELETE` and sends no CORS headers (no `OPTIONS` preflight handling; cross-origin browser callers need CORS in `proxy.ts` plus `allowedOrigins`). HTTP input uses bounded JSON reads and explicit origin checks (Origin against `X-Forwarded-Proto`/URL scheme plus `X-Forwarded-Host`/`Host`, since Next.js builds `request.url` from the configured hostname); application middleware owns authentication and authorization, and `stateSchema` validation plus `mapInput` run before the action's middleware stack. Sanitized 500 responses report their cause through the optional `onError` callback. The optional OpenAPI entry converts Standard JSON Schema without executing actions and flattens every schema into `components.schemas` (`$id`/`$schema` dropped, each `$defs` entry becomes a `<name>_<key>` component, local refs rewritten to `#/components/schemas/...`) so viewers such as Scalar and Redoc resolve them; document-relative `#/components/` refs in overrides pass through unchanged. OpenAPI error schema defaults (`serverErrorSchema`, `validationErrorsSchema`) are document options that a route's `openapi` can override. `requestBodyRequired` defaults to "an input schema exists", and `parameters` overrides are typed and checked against the path template. Production route and hook canaries live in `apps/playground/e2e/routes.spec.ts` and run in `pnpm run test:pg`.

## Codemod

`packages/codemod` ships the `next-safe-action-codemod` bin (`npx @next-safe-action/codemod v9 [paths...] [--dry] [--print] [--force] [--json]`). Its only runtime dependency is `ts-morph`, pinned exactly because it bundles its own TypeScript compiler API (the codemod must not depend on the user's or the repo's `typescript`, which may be TypeScript 7 with no JS API). `rules.ts` is the single source of truth (rule ids `V9-01`..`V9-04`, the type rename table, the client chain methods, the minimum versions, docs anchors), and `drift.test.ts` checks it against the core source, manifests, and the migration guide, so a core API change that the codemod should know about fails the codemod tests. `transform.ts` analyzes each file on an unmodified program and returns text edits plus "explained" ranges; nothing is renamed through the language service. `.schema()` is rewritten only when the chain root resolves (through imports, re-exports, `export *`, path aliases, namespaces, default exports) to `createSafeActionClient()` from `next-safe-action` or to a declaration typed `SafeActionClient`, or when the installed core proves the receiver type; anything undecided becomes a manual item. A final regex scan reports every leftover removed name, `stateful-hooks` specifier, or `.schema(` that the AST pass neither rewrote nor proved unrelated, so nothing is skipped silently. Tests are fixture based (`src/__tests__/fixtures/<case>/{input,expected,report.json}`, ignored by Oxfmt and Oxlint), and the CLI tests spawn `dist/cli.mjs`, so the package `test` script builds first.

## Testing

- Framework: Vitest
- Runtime test files follow `feature-name.test.ts` naming convention (`.test.tsx` for hook tests)
- Type tests in `src/__tests__/types/` follow `feature-name.test-d.ts` naming convention (Vitest `typecheck` mode)
- Add regression tests for behavioral or API changes

## Dependency Policy

**Never add entries to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`. This key must stay absent from the file.**

pnpm 11 applies a default `minimumReleaseAge` of 1440 minutes (24 hours), so a freshly published version cannot be installed until it has been on the registry for a full day. This is the repository's main defense against a compromised release: most malicious npm publishes are detected and unpublished within hours. `minimumReleaseAgeExclude` opts specific versions out of that cooldown and defeats the protection, which is why it is banned here, with no exceptions and no "just this once" entries.

Rules when updating dependencies:

- If a version range cannot resolve because every matching version is younger than 24 hours, **lower the range** to the newest version that is at least 24 hours old (for example `^13.1.0` becomes `^13.0.0`). Do not add an exclude entry, and do not disable or lower `minimumReleaseAge`.
- Prefer a slightly older, proven version over the newest release. Being one patch behind for a day is the intended trade-off.
- Never pass `--ignore-scripts=false`, and never widen `allowBuilds` without an explicit request. Packages outside `allowBuilds` must not run install scripts.
- Keep every dependency resolved from the npm registry. Do not introduce git or direct tarball resolutions, `overrides`, or `patchedDependencies` as a workaround for a blocked version.
- After a dependency update, run `pnpm audit` and confirm the update does not introduce new advisories.

## Changesets

PRs targeting `main` that touch package files should include a changeset. CI checks for this via `changeset status --since=origin/main`.

## Keeping This File Up to Date

When making changes to the codebase that affect information documented in this file, update the relevant sections of this file as part of the same change. Examples of changes that require an update:

- Adding, removing, or renaming packages or apps in the monorepo
- Bumping dependency versions in `pnpm-workspace.yaml` catalogs or root `package.json`
- Adding or removing source files, entry points, or exports in any package
- Changing build, test, lint, or format commands or tooling
- Modifying code style rules, linter config, or formatter config
- Altering the architecture (new hooks, middleware patterns, error handlers, etc.)

Do not wait for a separate follow-up: include the update in the same commit as the code change.
