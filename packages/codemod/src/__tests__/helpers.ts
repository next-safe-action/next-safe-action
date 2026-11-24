import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Report } from "../run";

export const FIXTURES = path.join(import.meta.dirname, "fixtures");

/** Copies a fixture's `input` directory to a fresh temp dir (outside any git repo). */
export function stageFixture(name: string): string {
	const dir = mkdtempSync(path.join(tmpdir(), `nsa-codemod-${name}-`));
	cpSync(path.join(FIXTURES, name, "input"), dir, { recursive: true });
	return dir;
}

export function writeFiles(root: string, files: Record<string, string>) {
	for (const [file, content] of Object.entries(files)) {
		mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
		writeFileSync(path.join(root, file), content);
	}
}

export function readTree(root: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
		if (!entry.isFile()) continue;
		const full = path.join(entry.parentPath, entry.name);
		out[path.relative(root, full)] = readFileSync(full, "utf8");
	}
	return out;
}

/** Drops the entry that depends on the Node.js version running the tests. */
export const stableReport = (report: Report): Report => ({
	...report,
	environment: report.environment.filter((e) => e.file !== "(current Node.js runtime)"),
});
