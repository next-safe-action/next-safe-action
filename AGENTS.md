# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Overview

next-safe-action is a TypeScript library for type-safe, validated Next.js Server Actions. It provides a chainable client API with middleware, input/output validation (via Standard Schema v1, Zod, Yup, etc.), and React hooks for client-side consumption.

## Monorepo Structure

- **`packages/next-safe-action`**: the core library (source in `src/`, tests in `src/__tests__/`)
- **`packages/adapter-react-hook-form`**: `@next-safe-action/adapter-react-hook-form` adapter for seamless react-hook-form integration
- **`packages/adapter-tanstack-query`**: `@next-safe-action/adapter-tanstack-query` adapter for TanStack Query mutation integration
- **`apps/playground`**: Next.js app for manual testing (Tailwind v4, shadcn/ui, Shiki code viewer)
- **`apps/docs`**: Fumadocs documentation site (content in `content/docs/`, MDX + Twoslash)

## Technology Stack

| Category | Technology | Version |
|---|---|---|
| Language | TypeScript | ^6.0.2 |
| Runtime | Node.js | >=18.17 |
| Package manager | pnpm (with catalogs) | 10.33.0 |
| Framework | Next.js | ^16 |
| UI library | React | ^19 |
| Monorepo orchestration | Turborepo | ^2.8.21 |
| Bundler | tsdown (Rolldown + Oxc) | ^0.21.0 |
| Test framework | Vitest | ^3.1.1 |
| Formatter | Oxfmt | ^0.42.0 |
| Linter | Oxlint (type-aware) | ^1.57.0 |
| Validation | Zod ^4.3.6, Yup ^1.6.1 (Standard Schema v1) | - |
| CSS framework | Tailwind CSS v4 | ^4 |
| Component library | shadcn/ui (Radix UI + CVA) | ^3.8.5 |
| Docs framework | Fumadocs (core + MDX + UI + Twoslash) | ^16.6.8 |
| Forms | react-hook-form + @hookform/resolvers | ^7.54.2 / ^5.0.0 |
| Data fetching | TanStack Query (React Query) | ^5.80.7 |
| Versioning | Changesets | ^2.30.0 |

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
| Run single test | `cd packages/next-safe-action && npx vitest run ./src/__tests__/<file>.test.ts` |
| Format all files | `pnpm run fmt` |
| Check formatting | `pnpm run fmt:check` |
| Create changeset | `pnpm run changeset` |
| Empty changeset (no bump) | `pnpm run changeset:empty` |

## Code Style

- **Formatter**: Oxfmt, tabs (tabWidth 2), printWidth 120, semicolons, double quotes, trailing commas (es5), import sorting, Tailwind CSS class sorting. Config in `.oxfmtrc.json`.
- **Linter**: Oxlint with type-aware checking via `oxlint-tsgolint`. Shared base config in `.oxlintrc.base.json`, package overrides in per-package `.oxlintrc.json`. Plugins: oxc, eslint, unicorn, typescript, react, react-perf (library packages), plus nextjs (app packages).
- **TypeScript**: strict mode with `noUncheckedIndexedAccess`. Library lint runs `tsc --noEmit && oxlint --type-aware .`.
- Prefer explicit type imports/exports (enforced by Oxlint).
- **CSS**: Tailwind v4 with CSS-first configuration (no tailwind.config file), PostCSS via `@tailwindcss/postcss`.
- **Punctuation**: Never use em dashes. Use commas, colons, or other appropriate punctuation instead.

## Architecture

The library has three entry points: `next-safe-action` (server), `next-safe-action/hooks`, and `next-safe-action/stateful-hooks` (client). The RHF adapter has two: `@next-safe-action/adapter-react-hook-form` and `@next-safe-action/adapter-react-hook-form/hooks`. The TanStack Query adapter has one: `@next-safe-action/adapter-tanstack-query`.

**Server-side core:**
- `safe-action-client.ts`: `SafeActionClient` class with chainable methods: `use()` (middleware), `metadata()`, `inputSchema()`, `outputSchema()`, `bindArgsSchema()`, `action()`, `stateAction()`
- `action-builder.ts`: core execution engine: runs the middleware stack, validates input/output via Standard Schema, handles errors
- `middleware.ts`: `createMiddleware()` for standalone middleware definitions
- `validation-errors.ts`: error formatting and flattening utilities
- `utils.ts`: utility constants (`DEFAULT_SERVER_ERROR_MESSAGE`) and helpers
- `standard-schema.ts`: Standard Schema v1 interface definitions and type utilities for schema inference
- `next/errors/`: `FrameworkErrorHandler` class with handlers for redirect, router, bailout-to-CSR, dynamic-usage, postpone, and HTTP access fallback (404/403/401) errors

**Client-side hooks:**
- `hooks.ts`: `useAction` and `useOptimisticAction` hooks for calling server actions from client components
- `hooks-shared.ts`: base hook logic (`useActionBase`) shared by `useAction` and `useOptimisticAction`
- `hooks-utils.ts`: shared hook utilities (`getActionStatus`, `getActionShorthandStatusObject`, `useActionCallbacks`)
- `stateful-hooks.ts`: `useStateAction` hook wrapping React's `useActionState`

**Type system:**
- `index.types.ts`: core types with full generic inference for schemas, middleware context, and action results
- `hooks.types.ts`, `utils.types.ts`, `validation-errors.types.ts`: supporting type definitions

**Build & distribution:**
- ESM-only output (`.mjs` + `.d.mts`) via tsdown
- pnpm catalogs in `pnpm-workspace.yaml` centralize shared dependency versions
- Turborepo orchestrates build/test/lint tasks with dependency-aware caching

## Testing

- Framework: Vitest
- Runtime test files follow `feature-name.test.ts` naming convention (`.test.tsx` for hook tests)
- Type tests in `src/__tests__/types/` follow `feature-name.test-d.ts` naming convention (Vitest `typecheck` mode)
- Add regression tests for behavioral or API changes

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
