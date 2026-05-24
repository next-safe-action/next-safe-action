---
"next-safe-action": patch
---

Remove the `deepmerge-ts` runtime dependency by inlining the small subset of deep-merge logic the library actually uses into an internal `deep-merge.ts`. Behavior is unchanged (records merged recursively, arrays concatenated, Sets/Maps combined, otherwise last value wins, with a `__proto__` pollution guard), and the package now ships with zero runtime dependencies.
