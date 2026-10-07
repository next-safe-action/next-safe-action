<div align="center">
  <img src="https://raw.githubusercontent.com/next-safe-action/next-safe-action/main/assets/logo.png" alt="next-safe-action logo" width="36" height="36">
  <a href="https://github.com/next-safe-action/next-safe-action/tree/main/packages/codemod"><h1>codemod</h1></a>
</div>

Codemods that migrate [next-safe-action](https://github.com/next-safe-action/next-safe-action) projects to a new major version. Full guide: [Migration from v8 to v9](https://next-safe-action.dev/docs/migrations/v8-to-v9). Flags and exit codes: [Codemod reference](https://next-safe-action.dev/docs/migrations/v8-to-v9#codemod-reference).

## Usage

Commit or stash your changes first, then run from the project root:

```sh
npx @next-safe-action/codemod@latest v9 [paths...] [options]
```

`paths` are files or directories (default: the current directory). Pass a directory such as `src` and the `package.json` files outside it are not checked for `V9-04`: the report then has an `unknown` entry with the file `(not found)`. Inside a git repository, files ignored by `.gitignore` are skipped. `node_modules`, `.next`, `dist`, `build`, `out`, `coverage`, `.turbo`, and `.git` are always skipped.

| Option | Description |
|---|---|
| `--dry` | Analyze and report, but do not write any file. |
| `--print` | Print each changed file instead of writing it. With `--json`, the files go to stderr. |
| `--force` | Write files even if the git working tree has uncommitted changes. |
| `--json` | Print a machine-readable report on stdout. Logs and errors go to stderr. |
| `-h`, `--help` | Show the help. |

Without `--dry`, `--print`, or `--force`, the codemod refuses to run (exit code 1) when the git working tree has uncommitted changes (untracked files count), so its changes are easy to review. Directories outside git are fine.

Exit codes: `0` on success (also when there are manual items), `1` on errors (for example a path that does not exist), an unknown transform or flag, or a dirty working tree.

The edits keep the existing formatting, quotes, line endings, and byte order mark. A merged import can leave a line that your formatter would lay out differently, so run your formatter afterwards if your project checks formatting.

## v9 rules

| Rule | Change | What the codemod does |
|---|---|---|
| [`V9-01`](https://next-safe-action.dev/docs/migrations/v8-to-v9#v9-01) | `next-safe-action/stateful-hooks` entry point removed | Rewrites every string literal that is exactly `next-safe-action/stateful-hooks` to `next-safe-action/hooks`, keeping the quotes: imports, `import type`, `export ... from`, `import()`, `require()`, `vi.mock()`/`jest.mock()`, and template literals without expressions. Merges the names into an existing `next-safe-action/hooks` import of the same kind when there is one. |
| [`V9-02`](https://next-safe-action.dev/docs/migrations/v8-to-v9#v9-02) | Deprecated type aliases removed | Renames `HookSafeActionFn` to `SingleInputActionFn`, `HookSafeStateActionFn` to `SingleInputStateActionFn`, `DVES` to `ValidationErrorsFormat`, `StateServerCodeFn` to `StatefulServerCodeFn`, and `SafeActionUtils` to `ActionCallbacks`, in imports, inline `type` specifiers, `as` aliases (the local alias is kept), barrels and re-exports and their consumers, namespace access (`nsa.DVES`), `import("next-safe-action").DVES`, and every reference. Only names that trace back to `next-safe-action` are renamed. |
| [`V9-03`](https://next-safe-action.dev/docs/migrations/v8-to-v9#v9-03) | `.schema()` client method removed | Replaces `.schema(` with `.inputSchema(` only when the receiver is proven to be a safe action client: the chain resolves, across files, to `createSafeActionClient()` from `next-safe-action` or to a declaration typed `SafeActionClient`, through `.use()`, `.useValidated()`, `.metadata()`, `.inputSchema()`, `.bindArgsSchemas()`, `.outputSchema()`, and `.schema()`. Other `.schema()` calls (Zod, Drizzle, calls after `.action()`) are left alone. Calls it cannot decide are reported. |
| [`V9-04`](https://next-safe-action.dev/docs/migrations/v8-to-v9#v9-04) | New minimum requirements | Reports only. In each `package.json` that depends on `next-safe-action` or an adapter, checks `next` (>= 15.1.0), `react` and `react-dom` (>= 19.0.0), `next-safe-action` (>= 9.0.0), the adapters (installed release with a `next-safe-action` peer of >= 9.0.0), and `engines.node`. Also checks `.nvmrc`, `.node-version`, and the running Node.js (>= 18.18). It prefers installed versions from `node_modules` and never edits `package.json`. The fix text has the install command for your package manager. |

After the rules run, the codemod scans every in-scope file (including `.md`, `.mdx`, `.vue`, `.svelte`, and `.astro`) for leftover removed names, `stateful-hooks` specifiers, and `.schema(` calls. Every occurrence that was not rewritten or proven unrelated is listed as a manual item. The codemod is idempotent: running it again changes nothing.

### What it does not do

- It does not edit `package.json` or install packages. Upgrade the dependencies listed under `V9-04` yourself.
- It does not rewrite `.schema()` on a receiver it cannot trace, for example a client returned by a wrapper function when `next-safe-action` is not installed, or a parameter without a `SafeActionClient` type. These become manual items.
- It does not edit comments, JSDoc, partial strings, Markdown, or framework files (`.vue`, `.svelte`, `.astro`). Occurrences there become manual items, and some of them are false positives (for example another library's `.schema()` in a Markdown file).
- It does not transform files with syntax errors. They are listed under `skipped`, and their leftovers become manual items.
- Renaming an un-aliased re-export (`export { DVES } from "next-safe-action"`) changes the name your module exports. Consumers in the scanned paths are updated, consumers outside them are not.

When `next-safe-action` is installed, the codemod also uses its types as proof, which covers wrapper functions. A removed type name that is re-exported through an `export * from "next-safe-action"` barrel can be traced only while v8 is installed. With v9 installed, each use becomes a manual item.

## JSON report

With `--json`, stdout contains one JSON object. See [Report format](https://next-safe-action.dev/docs/migrations/v8-to-v9#report-format) for the details.

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

Paths are relative to the current directory. `changes[].line` refers to the original file, `before` and `after` hold the full changed line(s), and `after` is `""` when a line was removed (a merged import). `manual[].line` and `column` refer to the migrated file. `environment` lists every check, including the passing ones (`status: "ok"`) and the running Node.js. `fix` is `""` for a passing check. `found` is always a string, ending with `(installed)` or `(declared)`. `unknown` means the codemod could not read a version (`workspace:`, `catalog:`, tags, `||` or `>` ranges, or an adapter that is not installed).

## License

MIT
