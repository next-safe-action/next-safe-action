import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { runV9 } from "../run";
import { writeFiles } from "./helpers";

// Lets a test force an analysis failure for one file (`explode.ts`), like an unexpected bug would.
vi.mock(import("../transform"), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		analyzeFile: (sf) => {
			if (sf.getBaseName() === "explode.ts") throw new Error("boom");
			return actual.analyzeFile(sf);
		},
	};
});

const dirs: string[] = [];
const project = (files: Record<string, string>) => {
	const dir = mkdtempSync(path.join(tmpdir(), "nsa-codemod-"));
	dirs.push(dir);
	writeFiles(dir, files);
	return dir;
};
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// A stand-in for an installed next-safe-action, so the type checker can prove the receiver type.
const installedCore = {
	"node_modules/next-safe-action/package.json": JSON.stringify({
		name: "next-safe-action",
		version: "8.5.0",
		types: "index.d.ts",
	}),
	"node_modules/next-safe-action/index.d.ts": [
		"export declare class SafeActionClient { schema(s: unknown): SafeActionClient; inputSchema(s: unknown): SafeActionClient; }",
		"export declare function createSafeActionClient(): SafeActionClient;",
		'export type DVES = "formatted" | "flattened";',
	].join("\n"),
};

test("proves a wrapper's return type when next-safe-action is installed", () => {
	const dir = project({
		...installedCore,
		"src/factory.ts":
			'import { createSafeActionClient } from "next-safe-action";\nexport const make = () => createSafeActionClient();\n',
		"src/action.ts": 'import { make } from "./factory";\nexport const a = make().schema({});\n',
	});
	const { report } = runV9({ paths: ["src"], cwd: dir, write: true });
	expect(report.manual).toEqual([]);
	expect(readFileSync(path.join(dir, "src/action.ts"), "utf8")).toContain("make().inputSchema({})");
});

test("follows `export *` from next-safe-action through a local barrel when it is installed", () => {
	const dir = project({
		...installedCore,
		"src/types.ts": 'export type * from "next-safe-action";\n',
		"src/use.ts": 'import type { DVES } from "./types";\nexport type A = DVES;\n',
	});
	runV9({ paths: ["src"], cwd: dir, write: true });
	expect(readFileSync(path.join(dir, "src/use.ts"), "utf8")).toBe(
		'import type { ValidationErrorsFormat } from "./types";\nexport type A = ValidationErrorsFormat;\n'
	);
});

test("reports an old name it cannot trace instead of ignoring it", () => {
	const dir = project({
		"src/types.ts": 'export type * from "next-safe-action";\n',
		"src/use.ts": 'import type { DVES } from "./types";\nexport type A = DVES;\n',
	});
	const { report } = runV9({ paths: ["src"], cwd: dir, write: true });
	expect(report.changes).toEqual([]);
	expect(report.manual.map((m) => `${m.rule} ${m.file}:${m.line}:${m.column}`)).toEqual([
		"V9-02 src/use.ts:1:15",
		"V9-02 src/use.ts:2:17",
	]);
});

test("keeps CRLF line endings and a BOM", () => {
	const dir = project({
		"a.ts": '﻿import { useStateAction } from "next-safe-action/stateful-hooks";\r\nexport { useStateAction };\r\n',
	});
	runV9({ paths: ["."], cwd: dir, write: true });
	expect(readFileSync(path.join(dir, "a.ts"), "utf8")).toBe(
		'﻿import { useStateAction } from "next-safe-action/hooks";\r\nexport { useStateAction };\r\n'
	);
});

test("does not write when `write` is false, but still returns the outputs", () => {
	const source = 'import { useStateAction } from "next-safe-action/stateful-hooks";\n';
	const dir = project({ "a.ts": source });
	const { outputs } = runV9({ paths: ["."], cwd: dir, write: false });
	expect(readFileSync(path.join(dir, "a.ts"), "utf8")).toBe(source);
	expect(outputs.get("a.ts")).toBe('import { useStateAction } from "next-safe-action/hooks";\n');
});

test("ignores node_modules and build output", () => {
	const dir = project({
		"node_modules/x/a.ts": 'import "next-safe-action/stateful-hooks";\n',
		".next/a.js": 'require("next-safe-action/stateful-hooks");\n',
		"dist/a.js": 'require("next-safe-action/stateful-hooks");\n',
	});
	const { report, scanned } = runV9({ paths: ["."], cwd: dir, write: true });
	expect(scanned).toBe(0);
	expect(report.manual).toEqual([]);
});

test("a file whose analysis fails lands in `skipped`, is not written, and the other files still migrate", () => {
	const source = 'import { useStateAction } from "next-safe-action/stateful-hooks";\n';
	const migrated = 'import { useStateAction } from "next-safe-action/hooks";\n';
	const dir = project({ "a.ts": source, "explode.ts": source, "z.ts": source });
	const { report } = runV9({ paths: ["."], cwd: dir, write: true });
	expect(readFileSync(path.join(dir, "a.ts"), "utf8")).toBe(migrated);
	expect(readFileSync(path.join(dir, "z.ts"), "utf8")).toBe(migrated);
	expect(readFileSync(path.join(dir, "explode.ts"), "utf8")).toBe(source);
	expect(report.changes.map((c) => c.file)).toEqual(["a.ts", "z.ts"]);
	expect(report.skipped).toEqual([{ file: "explode.ts", reason: expect.stringContaining("boom") }]);
});

test("drops old specifiers whose new name is already imported, in every import shape", () => {
	const types = 'import type { StatefulServerCodeFn, ValidationErrorsFormat } from "next-safe-action";\n';
	const use = "export type T = [DVES, StateServerCodeFn];\n";
	const usedNew = "export type T = [ValidationErrorsFormat, StatefulServerCodeFn];\n";
	const dir = project({
		"src/lib.ts": 'export type { DVES, StateServerCodeFn } from "next-safe-action";\nconst x = 1;\nexport default x;\n',
		"src/default-one.ts": `import x, { DVES } from "./lib";\n${types}export type U = DVES;\nexport default x;\n`,
		"src/default-all.ts": `import x, { DVES, StateServerCodeFn } from "./lib";\n${types}${use}export default x;\n`,
		"src/all.ts": `import { DVES, StateServerCodeFn } from "next-safe-action";\n${types}${use}`,
		"src/multiline.ts": `import {\n\tcreateSafeActionClient,\n\tDVES,\n\tStateServerCodeFn,\n} from "next-safe-action";\n${types}${use}export const c = createSafeActionClient;\n`,
		"src/middle.ts": `import { type DVES, createSafeActionClient, type StateServerCodeFn, returnServerError } from "next-safe-action";\n${types}${use}export const c = [createSafeActionClient, returnServerError];\n`,
	});
	const { report } = runV9({ paths: ["src"], cwd: dir, write: true });
	const read = (file: string) => readFileSync(path.join(dir, "src", file), "utf8");
	expect(report.skipped).toEqual([]);
	expect(report.manual).toEqual([]);
	expect(read("default-one.ts")).toBe(
		`import x from "./lib";\n${types}export type U = ValidationErrorsFormat;\nexport default x;\n`
	);
	expect(read("default-all.ts")).toBe(`import x from "./lib";\n${types}${usedNew}export default x;\n`);
	expect(read("all.ts")).toBe(`${types}${usedNew}`);
	expect(read("multiline.ts")).toBe(
		`import {\n\tcreateSafeActionClient,\n} from "next-safe-action";\n${types}${usedNew}export const c = createSafeActionClient;\n`
	);
	expect(read("middle.ts")).toBe(
		`import { createSafeActionClient, returnServerError } from "next-safe-action";\n${types}${usedNew}export const c = [createSafeActionClient, returnServerError];\n`
	);
});

test('handles `.schema<T>(` and `client["schema"](`, and reports an undecidable element access', () => {
	const dir = project({
		"src/safe-action.ts":
			'import { createSafeActionClient } from "next-safe-action";\nexport const client = createSafeActionClient();\n',
		"src/actions.ts": [
			'import { client } from "./safe-action";',
			"export const a = client.schema<unknown>({});",
			'export const b = client["schema"]({});',
			"export const c = client[`schema`]<unknown>({});",
			'export function f(x) { return x["schema"]({}); }',
			"",
		].join("\n"),
		"README.md": 'Call `client.schema<T>(s)` or `client["schema"](s)`.\n',
	});
	const { report } = runV9({ paths: ["."], cwd: dir, write: true });
	expect(readFileSync(path.join(dir, "src/actions.ts"), "utf8")).toBe(
		[
			'import { client } from "./safe-action";',
			"export const a = client.inputSchema<unknown>({});",
			'export const b = client["inputSchema"]({});',
			"export const c = client[`inputSchema`]<unknown>({});",
			'export function f(x) { return x["schema"]({}); }',
			"",
		].join("\n")
	);
	expect(report.manual.map((m) => `${m.rule} ${m.file}:${m.line}:${m.column}`)).toEqual([
		"V9-03 README.md:1:13",
		"V9-03 README.md:1:38",
		"V9-03 src/actions.ts:5:33",
	]);
});
