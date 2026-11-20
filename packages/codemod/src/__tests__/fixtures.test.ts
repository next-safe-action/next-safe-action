import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { runV9 } from "../run";
import { FIXTURES, readTree, stableReport, stageFixture } from "./helpers";

const staged: string[] = [];
afterEach(() => {
	for (const dir of staged.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe.each(readdirSync(FIXTURES))("fixture %s", (name) => {
	test("migrates to the expected files and report, and is idempotent", async () => {
		const dir = stageFixture(name);
		staged.push(dir);
		const input = readTree(dir);

		const dry = runV9({ paths: ["."], cwd: dir, write: false });
		expect(readTree(dir)).toEqual(input);
		const first = runV9({ paths: ["."], cwd: dir, write: true });
		// A real run must analyze exactly what a dry run sees, even when one tsconfig group's files
		// import another group's files.
		expect(first.report).toEqual(dry.report);
		expect(first.outputs).toEqual(dry.outputs);

		// Files in `expected` are the migrated version; every other input file must be untouched.
		const expectedDir = path.join(FIXTURES, name, "expected");
		const expected = existsSync(expectedDir) ? readTree(expectedDir) : {};
		const actual = readTree(dir);
		for (const [file, content] of Object.entries(input)) {
			expect(actual[file], file).toBe(expected[file] ?? content);
		}
		expect(Object.keys(actual).sort()).toEqual(Object.keys(input).sort());
		expect([...first.outputs.keys()].sort()).toEqual(Object.keys(expected).sort());
		await expect(JSON.stringify(stableReport(first.report), null, "\t") + "\n").toMatchFileSnapshot(
			path.join(FIXTURES, name, "report.json")
		);

		const second = runV9({ paths: ["."], cwd: dir, write: true });
		expect(second.report.changes).toEqual([]);
		expect(readTree(dir)).toEqual(actual);
		// A mock factory note belongs to the rewrite of its specifier, so only the rewriting run has it.
		const lasting = first.report.manual.filter((m) => !m.why.startsWith("This mock factory"));
		expect(second.report.manual).toEqual(lasting);
	});
});
