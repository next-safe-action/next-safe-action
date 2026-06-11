---
"next-safe-action": patch
---

Fix hook callbacks re-firing when a page is restored from the Next.js router bfcache (React `<Activity>`, enabled by `cacheComponents`): `onExecute`/`onSuccess`/`onError`/`onSettled`/`onNavigation` now fire once per action execution instead of replaying on every restore.
