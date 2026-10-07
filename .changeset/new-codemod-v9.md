---
"@next-safe-action/codemod": minor
---

Add `@next-safe-action/codemod`, a CLI that migrates projects from next-safe-action v8 to v9: `npx @next-safe-action/codemod@latest v9`. It rewrites `next-safe-action/stateful-hooks` imports to `next-safe-action/hooks`, renames the removed type aliases, and replaces `.schema()` with `.inputSchema()` on proven safe action clients. Anything it cannot prove safe is listed as a manual item with file and line, and it reports Next.js, React, adapter, and Node.js versions that need an upgrade. Use `--dry` to preview and `--json` for a machine-readable report.
