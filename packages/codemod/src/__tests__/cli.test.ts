import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "vitest";
import { writeFiles } from "./helpers";

// Runs the built CLI (the `test` script builds first).
const CLI = path.join(import.meta.dirname, "../../dist/cli.mjs");
const SOURCE = 'import { useStateAction } from "next-safe-action/stateful-hooks";\nexport { useStateAction };\n';
const MIGRATED = 'import { useStateAction } from "next-safe-action/hooks";\nexport { useStateAction };\n';

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function project(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "nsa-codemod-cli-"));
	dirs.push(dir);
	writeFiles(dir, { "src/a.ts": SOURCE });
	return dir;
}

const run = (cwd: string, ...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });
const read = (dir: string) => readFileSync(path.join(dir, "src/a.ts"), "utf8");

function gitRepo(dir: string) {
	const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
	git("init", "-q");
	git("add", ".");
	git(
		"-c",
		"user.name=test",
		"-c",
		"user.email=test@example.com",
		"-c",
		"commit.gpgsign=false",
		"commit",
		"-qm",
		"init"
	);
}

test("works in a directory that is not a git repo", () => {
	const dir = project();
	const result = run(dir, "v9");
	expect(result.status).toBe(0);
	expect(result.stdout).toContain("Changes: 1 in 1 file(s)");
	expect(read(dir)).toBe(MIGRATED);
});

test("--dry writes nothing", () => {
	const dir = project();
	const result = run(dir, "v9", "--dry");
	expect(result.status).toBe(0);
	expect(read(dir)).toBe(SOURCE);
});

test("--json prints a valid report on stdout and logs on stderr", () => {
	const dir = project();
	const result = run(dir, "v9", "src", "--json", "--dry");
	expect(result.status).toBe(0);
	const report = JSON.parse(result.stdout);
	expect(Object.keys(report)).toEqual(["changes", "manual", "environment", "skipped"]);
	expect(report.changes).toEqual([
		{
			rule: "V9-01",
			file: "src/a.ts",
			line: 1,
			before: 'import { useStateAction } from "next-safe-action/stateful-hooks";',
			after: 'import { useStateAction } from "next-safe-action/hooks";',
		},
	]);
	expect(result.stderr).toContain("1 change(s)");
});

test("--print prints the transformed file without writing it", () => {
	const dir = project();
	const result = run(dir, "v9", "--print");
	expect(result.status).toBe(0);
	expect(result.stdout).toContain(`// src/a.ts\n${MIGRATED}`);
	expect(read(dir)).toBe(SOURCE);
});

test("refuses a dirty git tree unless --force is passed", () => {
	const dir = project();
	gitRepo(dir);
	writeFileSync(path.join(dir, "src/b.ts"), "export {};\n");

	const refused = run(dir, "v9");
	expect(refused.status).toBe(1);
	expect(refused.stderr).toContain("uncommitted changes");
	expect(read(dir)).toBe(SOURCE);

	const forced = run(dir, "v9", "--force");
	expect(forced.status).toBe(0);
	expect(read(dir)).toBe(MIGRATED);
});

test("runs on a clean git tree", () => {
	const dir = project();
	gitRepo(dir);
	expect(run(dir, "v9").status).toBe(0);
	expect(read(dir)).toBe(MIGRATED);
});

test("rejects unknown transforms and flags", () => {
	const dir = project();
	expect(run(dir, "v10").status).toBe(1);
	expect(run(dir).status).toBe(1);
	expect(run(dir, "v9", "--nope").status).toBe(1);
	expect(run(dir, "--help").status).toBe(0);
});
