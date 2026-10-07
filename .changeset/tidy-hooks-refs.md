---
"next-safe-action": patch
---

Stop writing refs during render in the hooks: the transition seam and the stateful strategies are now used directly, since both are referentially stable.
