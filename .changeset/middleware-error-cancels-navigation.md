---
"next-safe-action": patch
---

Let a middleware error raised after `next()` replace a navigation that the action started. Before, when the action called `redirect()`, `notFound()` or another navigation function, an error thrown by a middleware after `next()` (for example a transaction that failed to commit) was passed to `handleServerError` and then discarded, and the client still followed the redirect. Now that error, a `returnServerError()` or a `returnValidationErrors()` becomes the action result, `onError` and `onSettled` run instead of `onNavigation`, and the navigation is dropped. A navigation function called by the middleware itself after `next()` still replaces the action's navigation.
