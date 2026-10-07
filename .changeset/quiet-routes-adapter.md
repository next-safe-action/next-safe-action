---
"next-safe-action": minor
"@next-safe-action/adapter-routes": minor
---

Add `getActionDefinition()` to read the schemas and shape of a defined action, a narrow framework-error inspector, and a cross-instance brand on `ActionValidationError`. Add the routes adapter, with a typed router (with optional path prefixes and `mergeRouters()` for subrouters) that maps ordinary actions to JSON mutation endpoints, stateful action envelopes, bounded request bodies, origin checks, an `onError` reporting callback, and optional OpenAPI 3.1 generation with `requestBodyRequired` and typed `parameters` overrides.
