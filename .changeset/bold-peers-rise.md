---
"next-safe-action": major
"@next-safe-action/adapter-react-hook-form": major
"@next-safe-action/adapter-tanstack-query": minor
"@next-safe-action/adapter-better-auth": patch
---

Require Next.js >= 15.1.0, React >= 19.0.0, and Node.js >= 18.18. Next.js 14 and React 18 are no longer supported: `notFound()` detection relies on the `NEXT_HTTP_ERROR_FALLBACK` digest introduced in Next.js 15.1, and the hooks rely on React 19's `useActionState` and `useOptimistic`. The runtime guard that threw on React versions without `useActionState` is removed.
