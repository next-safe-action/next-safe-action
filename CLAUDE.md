# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

next-safe-action is a TypeScript library for type-safe, validated Next.js Server Actions. It provides a chainable client API with middleware, input/output validation (via Standard Schema v1 — Zod, Yup, etc.), and React hooks for client-side consumption.

## Monorepo Structure

- **`packages/next-safe-action`** — the library (source in `src/`, tests in `src/__tests__/`)
- **`apps/playground`** — Next.js app for manual testing
- **`apps/docs`** — Fumadocs documentation site (content in `content/docs/`)

## Commands

All commands run from the repository root unless noted.

| Task | Command |
|---|---|
| Install dependencies | `pnpm install` |
| Build library | `pnpm run build:lib` |
| Build + start playground | `pnpm run build:lib && pnpm run pg` |
| Start docs dev server | `pnpm run docs` |
| Build docs | `pnpm run build:docs` |
| Lint docs | `pnpm run lint:docs` |
| Lint library | `pnpm run lint:lib` |
| Test library | `pnpm run test:lib` |
| Run single test | `cd packages/next-safe-action && npx vitest run ./src/__tests__/<file>.test.ts` |
| Format all files | `pnpm run fmt` |
| Check formatting | `pnpm run fmt:check` |
| Create changeset | `pnpm run changeset` |
| Empty changeset (no bump) | `pnpm run changeset -- --empty` |

## Code Style

- **Formatter**: Oxfmt — tabs (tabWidth 2), printWidth 120, semicolons, double quotes, trailing commas (es5). Config in `.oxfmtrc.json`.
- **Linter**: Oxlint with type-aware checking. Shared base config in `.oxlintrc.base.json`, package overrides in per-package `.oxlintrc.json`.
- **TypeScript**: strict mode with `noUncheckedIndexedAccess`. Library lint runs `tsc --noEmit && oxlint --type-aware .`.
- Prefer explicit type imports/exports (enforced by Oxlint).

## Architecture

The library has three entry points: `next-safe-action` (server), `next-safe-action/hooks`, and `next-safe-action/stateful-hooks` (client).

**Server-side core:**
- `safe-action-client.ts` — `SafeActionClient` class with chainable methods: `use()` (middleware), `metadata()`, `inputSchema()`, `outputSchema()`, `bindArgsSchema()`, `action()`, `stateAction()`
- `action-builder.ts` — core execution engine: runs the middleware stack, validates input/output via Standard Schema, handles errors
- `middleware.ts` — `createMiddleware()` for standalone middleware definitions
- `validation-errors.ts` — error formatting and flattening utilities
- `next/errors/` — handlers for Next.js framework errors (redirect, not-found, unauthorized, etc.) via `FrameworkErrorHandler` class

**Client-side hooks:**
- `hooks.ts` — `useAction` hook for calling server actions from client components
- `stateful-hooks.ts` — `useStateAction` hook wrapping React's `useActionState`

**Type system:**
- `index.types.ts` — core types with full generic inference for schemas, middleware context, and action results
- `hooks.types.ts`, `utils.types.ts`, `validation-errors.types.ts` — supporting type definitions

## Testing

- Framework: Vitest
- Test files follow `feature-name.test.ts` naming convention
- Add regression tests for behavioral or API changes

## Changesets

PRs targeting `main` that touch package files should include a changeset. CI checks for this via `changeset status --since=origin/main`.
