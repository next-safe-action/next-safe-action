---
"next-safe-action": patch
---

Re-throw the `HANGING_PROMISE_REJECTION` and `NEXT_PRERENDER_INTERRUPTED` framework signals that Next.js raises during `cacheComponents` prerenders, instead of passing them to `handleServerError`, `onError`, and the `serverError` result.
