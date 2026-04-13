---
"next-safe-action": patch
---

Filter out undefined entries from the callback promises array before awaiting `Promise.all`, to satisfy the stricter `await-thenable` rule in the latest `oxlint-tsgolint`. No runtime behavior change.
