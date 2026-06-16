---
"next-safe-action": patch
---

Fix `returnValidationErrors` being reported as a generic server error when called inside a Next.js `'use cache'` scope (`cacheComponents` enabled). Crossing the RSC boundary strips the thrown error's class identity, so the `instanceof` check failed and the client received `DEFAULT_SERVER_ERROR_MESSAGE` instead of the validation errors. The errors are now encoded on the error `digest` (the only channel Next.js preserves across the boundary, the same mechanism used to detect `redirect`/`notFound`) and correctly returned as `validationErrors`, matching the behavior when `cacheComponents` is disabled.
