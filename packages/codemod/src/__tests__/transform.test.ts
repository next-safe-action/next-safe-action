import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "vitest";
import { runV9 } from "../run";
import { writeFiles } from "./helpers";

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
