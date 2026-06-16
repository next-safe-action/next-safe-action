---
"next-safe-action": patch
---

Harden validation-error building against prototype pollution. `buildValidationErrors` walks the (potentially client-controlled) Standard Schema issue paths to build the nested errors object: with a `record`/catchall schema, an input like `{"constructor":{"prototype":{...}}}` produced an issue path that walked the prototype chain and wrote to `Object.prototype`. Paths are now traversed with `Object.hasOwn` and written with own-property descriptors, so hostile keys (`__proto__`, `constructor`, `prototype`) are stored as plain own properties and can never reach the global prototype. As defense-in-depth, `flattenValidationErrors` assigns field keys the same safe way, the validation payload recovered from the error `digest` is parsed with a `__proto__`-stripping reviver, and `returnValidationErrors` now throws a clear error when given a non-JSON-serializable payload instead of leaking a raw `TypeError`.
