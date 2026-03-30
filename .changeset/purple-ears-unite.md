---
"next-safe-action": minor
---

Add `throwOnNavigation` flag to internal hooks, which defaults to false. When set to true, next/navigation functions such as `forbidden()` and `notFound()` will actually fire the navigation to an error page. `onNavigation` and `onSettled` callbacks can't be used in hooks when this flag is set to true, due to how Next.js and React handle navigations.
