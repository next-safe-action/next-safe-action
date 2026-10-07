#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { gitStatus } from "./files";
import { RULES, type RuleId } from "./rules";
import { type Report, runV9 } from "./run";

const HELP = `Usage: npx @next-safe-action/codemod@latest v9 [paths...] [options]

Migrates a next-safe-action v8 project to v9. Paths default to the current directory.

Options:
  --dry     Analyze and report, but do not write any file.
  --print   Print the transformed files instead of writing them.
  --force   Run even if the git working tree has uncommitted changes.
  --json    Print a machine-readable JSON report on stdout (logs go to stderr).
  -h, --help  Show this help.

Guide: https://next-safe-action.dev/docs/migrations/v8-to-v9`;

function formatHuman(report: Report, scanned: number, wrote: boolean): string {
	const out: string[] = [
		`next-safe-action v9 codemod: scanned ${scanned} files${wrote ? "" : " (no files written)"}.`,
		"",
	];
	const files = new Set(report.changes.map((c) => c.file));
	out.push(`Changes: ${report.changes.length} in ${files.size} file(s)`);
	for (const rule of Object.keys(RULES) as RuleId[]) {
		const count = report.changes.filter((c) => c.rule === rule).length;
		if (count > 0) out.push(`  ${rule} ${RULES[rule].title}: ${count}`);
	}
	for (const change of report.changes) {
		out.push(`  ${change.file}:${change.line} [${change.rule}]`);
		for (const line of change.before.split("\n")) out.push(`    - ${line}`);
		for (const line of change.after ? change.after.split("\n") : []) out.push(`    + ${line}`);
	}

	out.push("", `Manual review: ${report.manual.length}`);
	for (const item of report.manual) {
		out.push(
			`  ${item.file}:${item.line}:${item.column} [${item.rule}] ${item.snippet}`,
			`    Why: ${item.why}`,
			`    Fix: ${item.fix}`,
			`    Docs: ${item.docs}`
		);
	}

	const env = report.environment.filter((e) => e.status !== "ok");
	out.push(
		"",
		`Environment (V9-04): ${env.length === 0 ? "all checks passed" : `${env.length} item(s) need attention`}`
	);
	for (const item of env) {
		out.push(
			`  ${item.file}: ${item.package} ${item.found}, requires ${item.required} [${item.status}]`,
			`    Fix: ${item.fix}`
		);
	}
	if (env.length > 0) out.push(`  Docs: ${RULES["V9-04"].docs}`);

	if (report.skipped.length > 0) {
		out.push("", `Skipped: ${report.skipped.length}`);
		for (const item of report.skipped) out.push(`  ${item.file}: ${item.reason}`);
	}
	out.push("", "Next: review the diff, run your type checker and tests, and resolve the manual items above.");
	return out.join("\n");
}

function main(argv: string[]): number {
	let parsed;
	try {
		parsed = parseArgs({
			args: argv,
			allowPositionals: true,
			options: {
				dry: { type: "boolean", default: false },
				print: { type: "boolean", default: false },
				force: { type: "boolean", default: false },
				json: { type: "boolean", default: false },
				help: { type: "boolean", short: "h", default: false },
			},
		});
	} catch (error) {
		console.error(`${error instanceof Error ? error.message : String(error)}\n\n${HELP}`);
		return 1;
	}
	const { values, positionals } = parsed;
	if (values.help) {
		console.log(HELP);
		return 0;
	}
	const [transform, ...paths] = positionals;
	if (transform !== "v9") {
		console.error(`${transform ? `Unknown transform "${transform}"` : "Missing transform"}. Available: v9.\n\n${HELP}`);
		return 1;
	}
	const targets = paths.length > 0 ? paths : ["."];
	const write = !values.dry && !values.print;

	try {
		// Before the git check, so a typo shows this message instead of a raw `stat` error.
		for (const target of targets) {
			if (!existsSync(path.resolve(target))) throw new Error(`Path not found: ${target}`);
		}
		if (write && !values.force) {
			for (const target of targets) {
				const abs = path.resolve(target);
				const status = gitStatus(statSync(abs).isDirectory() ? abs : path.dirname(abs));
				if (status?.trim()) {
					console.error(
						"The git working tree has uncommitted changes. Commit or stash them first so the codemod changes are easy to review, or pass --force (or --dry to preview)."
					);
					return 1;
				}
			}
		}

		const { report, outputs, scanned } = runV9({ paths: targets, write });
		if (values.print) {
			const print = values.json ? console.error : console.log;
			for (const [file, content] of outputs) print(`// ${file}\n${content}`);
		}
		if (values.json) {
			console.log(JSON.stringify(report, null, 2));
			console.error(
				`next-safe-action v9 codemod: ${report.changes.length} change(s), ${report.manual.length} manual item(s)${write ? "" : " (no files written)"}.`
			);
		} else {
			console.log(formatHuman(report, scanned, write));
		}
		return 0;
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		return 1;
	}
}

process.exitCode = main(process.argv.slice(2));
