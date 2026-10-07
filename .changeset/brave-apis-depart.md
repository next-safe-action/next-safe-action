---
"next-safe-action": major
---

Remove deprecated APIs: the `.schema()` client method (use `.inputSchema()`), the `next-safe-action/stateful-hooks` entry point (import `useStateAction` from `next-safe-action/hooks`), and the type aliases `HookSafeActionFn` (use `SingleInputActionFn`), `HookSafeStateActionFn` (use `SingleInputStateActionFn`), `DVES` (use `ValidationErrorsFormat`), `StateServerCodeFn` (use `StatefulServerCodeFn`), and `SafeActionUtils` (use `ActionCallbacks`). Run `npx @next-safe-action/codemod v9` to migrate automatically.
