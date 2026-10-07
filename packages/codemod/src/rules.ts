// Single source of truth for the v8 -> v9 migration. The drift test in `__tests__/drift.test.ts`
// checks this table against the core package source, so a rename or a new client method in core
// cannot silently fall out of sync with the codemod.

export type RuleId = "V9-01" | "V9-02" | "V9-03" | "V9-04";

const DOCS_BASE = "https://next-safe-action.dev/docs/migrations/v8-to-v9";

export const RULES: Record<RuleId, { title: string; docs: string }> = {
	"V9-01": { title: "`next-safe-action/stateful-hooks` entry point removed", docs: `${DOCS_BASE}#v9-01` },
	"V9-02": { title: "Deprecated type aliases removed", docs: `${DOCS_BASE}#v9-02` },
	"V9-03": { title: "`.schema()` client method removed", docs: `${DOCS_BASE}#v9-03` },
	"V9-04": { title: "Minimum Next.js, React, and Node.js versions raised", docs: `${DOCS_BASE}#v9-04` },
};

export const NSA_PACKAGE = "next-safe-action";
export const REMOVED_ENTRY = "next-safe-action/stateful-hooks";
export const REPLACEMENT_ENTRY = "next-safe-action/hooks";

export const isNsaModule = (specifier: string) => specifier === NSA_PACKAGE || specifier.startsWith(`${NSA_PACKAGE}/`);

/** Removed type aliases. Same generic parameters, same order. `module` is where v8 exported the old name. */
export const TYPE_RENAMES = [
	{ from: "HookSafeActionFn", to: "SingleInputActionFn", module: "next-safe-action/hooks" },
	{ from: "HookSafeStateActionFn", to: "SingleInputStateActionFn", module: "next-safe-action/hooks" },
	{ from: "DVES", to: "ValidationErrorsFormat", module: "next-safe-action" },
	{ from: "StateServerCodeFn", to: "StatefulServerCodeFn", module: "next-safe-action" },
	{ from: "SafeActionUtils", to: "ActionCallbacks", module: "next-safe-action" },
] as const;

export const RENAMED_TYPES: ReadonlyMap<string, string> = new Map(TYPE_RENAMES.map((r) => [r.from, r.to]));

/** `SafeActionClient` methods that return another client, plus the removed `schema` alias. */
export const CLIENT_CHAIN_METHODS: ReadonlySet<string> = new Set([
	"use",
	"useValidated",
	"metadata",
	"inputSchema",
	"bindArgsSchemas",
	"outputSchema",
	"schema",
]);

/** Minimum versions required by next-safe-action v9 (mirrors the core peer dependencies and engines). */
export const ENV_REQUIREMENTS = {
	"next": "15.1.0",
	"react": "19.0.0",
	"react-dom": "19.0.0",
	"next-safe-action": "9.0.0",
	"node": "18.18.0",
} as const;

/** Adapters must be on a release whose `next-safe-action` peer range starts at v9. */
export const ADAPTERS = [
	"@next-safe-action/adapter-react-hook-form",
	"@next-safe-action/adapter-tanstack-query",
	"@next-safe-action/adapter-better-auth",
] as const;

// Residual patterns: anything left after the AST rules that matches these is reported, never ignored.
export const RESIDUAL_PATTERNS: { rule: RuleId; regex: RegExp }[] = [
	{ rule: "V9-01", regex: /next-safe-action\/stateful-hooks/g },
	{ rule: "V9-02", regex: new RegExp(`\\b(?:${[...RENAMED_TYPES.keys()].join("|")})\\b`, "g") },
	// `.schema(`, `.schema<T>(`, and `client["schema"](`. No capture groups: `run.ts` joins these sources.
	{ rule: "V9-03", regex: /\.schema\s*[(<]|\[\s*["'`]schema["'`]\s*\]\s*[(<]/g },
];

export const CODE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
export const TEXT_EXTENSIONS = [".md", ".mdx", ".vue", ".svelte", ".astro"];
/**
 * Never scanned, even when tracked by git: dependencies, git internals, and tool caches whose
 * dot-names no source directory uses. `build`, `out`, `dist`, and `coverage` are not here because
 * they are valid source directory names (for example the route `src/app/out/page.tsx`); inside git,
 * `.gitignore` decides about them.
 */
export const ALWAYS_IGNORED_DIRS = ["node_modules", ".git", ".next", ".turbo"];
/** Skipped by the walk outside git, where no `.gitignore` tells build output apart from sources. */
export const WALK_IGNORED_DIRS = [...ALWAYS_IGNORED_DIRS, "dist", "build", "out", "coverage"];
