<div align="center">
  <img src="https://raw.githubusercontent.com/next-safe-action/next-safe-action/main/assets/logo.png" alt="next-safe-action logo" width="36" height="36">
  <a href="https://github.com/next-safe-action/next-safe-action/tree/main/packages/codemod"><h1>codemod</h1></a>
</div>

Codemods that migrate [next-safe-action](https://github.com/next-safe-action/next-safe-action) projects to a new major version. Full guide: [Migration from v8 to v9](https://next-safe-action.dev/docs/migrations/v8-to-v9).

## Usage

Commit or stash your changes first, then run from the project root:

```sh
npx @next-safe-action/codemod@latest v9 [paths...] [options]
```

`paths` are files or directories (default: the current directory). Inside a git repository, files ignored by `.gitignore` are skipped. `node_modules`, `.next`, `dist`, `build`, `out`, `coverage`, `.turbo`, and `.git` are always skipped.

| Option | Description |
|---|---|
| `--dry` | Analyze and report, but do not write any file. |
| `--print` | Print the transformed files instead of writing them. |
| `--force` | Run even if the git working tree has uncommitted changes. |
| `--json` | Print a machine-readable report on stdout. Logs go to stderr. |
| `-h`, `--help` | Show the help. |

Without `--dry`, `--print`, or `--force`, the codemod refuses to run (exit code 1) when the git working tree is not clean, so its changes are easy to review. Directories outside git are fine.

Exit codes: `0` on success (also when there are manual items), `1` on errors or a dirty working tree.

## v9 rules

| Rule | Change | What the codemod does |
|---|---|---|
| [`V9-01`](https://next-safe-action.dev/docs/migrations/v8-to-v9#v9-01) | `next-safe-action/stateful-hooks` entry point removed | Rewrites the specifier to `next-safe-action/hooks` in imports, `export ... from`, `import type`, `import()`, `require()`, and mock calls such as `vi.mock()`/`jest.mock()`. Merges it into an existing `next-safe-action/hooks` import when there is one. |
| [`V9-02`](https://next-safe-action.dev/docs/migrations/v8-to-v9#v9-02) | Deprecated type aliases removed | Renames `HookSafeActionFn` to `SingleInputActionFn`, `HookSafeStateActionFn` to `SingleInputStateActionFn`, `DVES` to `ValidationErrorsFormat`, `StateServerCodeFn` to `StatefulServerCodeFn`, and `SafeActionUtils` to `ActionCallbacks`, in imports, inline `type` specifiers, `as` aliases (the local alias is kept), re-exports and their consumers, namespace access (`nsa.DVES`), `import("next-safe-action").DVES`, and every reference. Only names that trace back to `next-safe-action` are renamed. |
| [`V9-03`](https://next-safe-action.dev/docs/migrations/v8-to-v9#v9-03) | `.schema()` client method removed | Replaces `.schema(` with `.inputSchema(` only when the receiver is proven to be a safe action client: the chain resolves, across files, to `createSafeActionClient()` from `next-safe-action` or to a declaration typed `SafeActionClient`. Other `.schema()` calls (Zod, Drizzle, calls after `.action()`) are left alone. Calls it cannot decide are reported. |
| [`V9-04`](https://next-safe-action.dev/docs/migrations/v8-to-v9#v9-04) | New minimum requirements | Reports only. Checks `next` (>= 15.1.0), `react` and `react-dom` (>= 19.0.0), `next-safe-action` (>= 9.0.0), the adapters (a release that supports next-safe-action v9), `engines.node`, `.nvmrc`, `.node-version`, and the running Node.js (>= 18.18). It prefers installed versions from `node_modules` and never edits `package.json`. |

After the rules run, the codemod scans every in-scope file (including `.md`, `.mdx`, `.vue`, `.svelte`, and `.astro`) for leftover removed names, `stateful-hooks` specifiers, and `.schema(` calls. Every occurrence that was not rewritten or proven unrelated is listed as a manual item. The codemod is idempotent: running it again changes nothing.

### What it does not do

- It does not edit `package.json` or install packages. Upgrade the dependencies listed under `V9-04` yourself.
- It does not rewrite `.schema()` on a receiver it cannot trace, for example a client returned by a wrapper function when `next-safe-action` is not installed, or a parameter without a `SafeActionClient` type. These become manual items.
- It does not edit comments, strings, JSDoc, Markdown, or framework files (`.vue`, `.svelte`, `.astro`). Occurrences there become manual items.
- It does not transform files with syntax errors. They are listed under `skipped`, and their leftovers become manual items.
- Renaming an un-aliased re-export (`export { DVES } from "next-safe-action"`) changes the name your module exports. Consumers in the scanned paths are updated, consumers outside them are not.

For the most precise results, run the codemod before you upgrade `next-safe-action`: with v8 still installed, the codemod can also use the installed types as proof.

## JSON report

With `--json`, stdout contains one JSON object:

```ts
type Report = {
	changes: { rule: string; file: string; line: number; before: string; after: string }[];
	manual: {
		rule: string;
		file: string;
		line: number;
		column: number;
		snippet: string;
		why: string;
		fix: string;
		docs: string;
	}[];
	environment: {
		rule: "V9-04";
		file: string;
		package: string;
		found: string;
		required: string;
		status: "ok" | "upgrade" | "unknown";
		fix: string;
	}[];
	skipped: { file: string; reason: string }[];
};
```

Paths are relative to the current directory. `changes[].line` refers to the original file, `before` and `after` hold the full changed line(s). `manual[].line` and `column` refer to the migrated file. `environment` lists every check, including the passing ones (`status: "ok"`).

## License

MIT
