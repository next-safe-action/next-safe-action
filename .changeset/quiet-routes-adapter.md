---
"next-safe-action": minor
---

Add built-in route handlers at `next-safe-action/routes`: a typed router (with optional path prefixes and `mergeRouters()` for subrouters) that maps ordinary actions to JSON mutation endpoints (action first, then path), with automatic, type-checked merging of path parameters into the action input (path wins over the body, `mapInput` stays as an escape hatch), with stateful action envelopes, bounded request bodies, origin checks, and an `onError` reporting callback. Optional OpenAPI 3.1 generation lives at `next-safe-action/routes/openapi`, with path parameters derived from the input schema, plus `requestBodyRequired` and typed `parameters` overrides.
