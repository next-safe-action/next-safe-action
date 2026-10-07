---
"next-safe-action": minor
---

Add built-in route handlers at `next-safe-action/routes`: a typed router (with optional path prefixes and `mergeRouters()` for subrouters) that maps ordinary actions to JSON mutation endpoints, with stateful action envelopes, bounded request bodies, origin checks, and an `onError` reporting callback. Optional OpenAPI 3.1 generation lives at `next-safe-action/routes/openapi`, with `requestBodyRequired` and typed `parameters` overrides.
