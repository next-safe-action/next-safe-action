import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { checkEnvironment, type EnvItem } from "./environment";
import { isCodeFile, listFiles } from "./files";
import { NSA_PACKAGE, RESIDUAL_PATTERNS, RULES, type RuleId } from "./rules";
import {
	analyzeFile,
	applyEdits,
	createProjects,
	type Edit,
	type ManualItem,
	mapOffset,
	type PendingManual,
	residualScan,
} from "./transform";

export type Change = { rule: RuleId; file: string; line: number; before: string; after: string };
export type Skipped = { file: string; reason: string };
export type Report = { changes: Change[]; manual: ManualItem[]; environment: EnvItem[]; skipped: Skipped[] };

export type RunOptions = {
	/** Files or directories to migrate, relative to `cwd`. */
	paths: string[];
	cwd?: string;
	/** Write the transformed files to disk. */
	write: boolean;
};

export type RunResult = {
	report: Report;
	/** Transformed content of every changed file, keyed by path relative to `cwd`. */
	outputs: Map<string, string>;
	scanned: number;
};

// A file is parsed only if it mentions the package or matches a residual pattern.
const CANDIDATE = new RegExp([NSA_PACKAGE, ...RESIDUAL_PATTERNS.map((p) => p.regex.source)].join("|"));

function lineStarts(text: string): number[] {
	const starts = [0];
	for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
	return starts;
}

/** 0-based line index of `pos`. */
function lineIndex(starts: number[], pos: number): number {
	let lo = 0;
	let hi = starts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (starts[mid]! <= pos) lo = mid;
		else hi = mid - 1;
	}
	return lo;
}

/** Offset of the end of line `index`, before its line break. */
function lineEnd(text: string, starts: number[], index: number): number {
	const end = index + 1 < starts.length ? starts[index + 1]! - 1 : text.length;
	return text[end - 1] === "\r" ? end - 1 : end;
}

const lineText = (text: string, starts: number[], index: number) =>
	text.slice(starts[index], lineEnd(text, starts, index));

/** One change per rule and original line, with the full before/after line(s) for context. */
function toChanges(file: string, text: string, edits: Edit[]): Change[] {
	const starts = lineStarts(text);
	const groups = new Map<string, { rule: RuleId; first: number; last: number }>();
	for (const edit of edits) {
		const first = lineIndex(starts, edit.start);
		const last = lineIndex(starts, Math.max(edit.start, edit.end - 1));
		const key = `${edit.rule}:${first}`;
		const group = groups.get(key);
		if (group) group.last = Math.max(group.last, last);
		else groups.set(key, { rule: edit.rule, first, last });
	}
	return [...groups.values()].map(({ rule, first, last }) => {
		const spanStart = starts[first]!;
		const spanEnd = lineEnd(text, starts, last);
		const local = edits
			.filter((e) => e.start >= spanStart && e.start <= spanEnd)
			.map((e) => ({ ...e, start: e.start - spanStart, end: Math.min(e.end, spanEnd) - spanStart }));
		return {
			rule,
			file,
			line: first + 1,
			before: text.slice(spanStart, spanEnd),
			after: applyEdits(text.slice(spanStart, spanEnd), local),
		};
	});
}

function toManual(file: string, pending: PendingManual[], text: string, edits: Edit[]): ManualItem[] {
	// Line numbers refer to the migrated file (the same as the original unless an import was merged above).
	const starts = lineStarts(text);
	return pending.map(({ pos, rule, why, fix }) => {
		const mapped = mapOffset(pos, edits);
		const index = lineIndex(starts, mapped);
		return {
			rule,
			file,
			line: index + 1,
			column: mapped - starts[index]! + 1,
			snippet: lineText(text, starts, index).trim().slice(0, 200),
			why,
			fix,
			docs: RULES[rule].docs,
		};
	});
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message.split("\n")[0] : String(error));

/**
 * Runs the v9 migration. Never throws for a single bad file: it lands in `skipped`. Every file is
 * analyzed before anything is written, so each tsconfig group sees the original sources of the
 * others (a real run matches `--dry`) and a failure can never leave a half-written tree.
 */
export function runV9({ paths, cwd = process.cwd(), write }: RunOptions): RunResult {
	const { files, symlinks } = listFiles(paths.map((p) => path.resolve(cwd, p)));
	const rel = (file: string) => path.relative(cwd, file) || path.basename(file);
	const report: Report = { changes: [], manual: [], environment: [], skipped: [] };
	const outputs = new Map<string, string>();
	const writes: { file: string; content: string }[] = [];
	const skip = (file: string, reason: string) => report.skipped.push({ file: rel(file), reason });

	for (const link of symlinks) {
		skip(
			link,
			"This path is a symlink. It is not followed, so a write cannot leave the project; pass its target instead."
		);
	}

	const candidates: string[] = [];
	for (const file of files) {
		if (path.basename(file) === "package.json" || [".nvmrc", ".node-version"].includes(path.basename(file))) continue;
		let text: string;
		try {
			text = readFileSync(file, "utf8");
		} catch (error) {
			skip(file, `Could not read this file (${errorMessage(error)}).`);
			continue;
		}
		if (!CANDIDATE.test(text)) continue;
		if (isCodeFile(file)) {
			candidates.push(file);
		} else {
			// Non-JS files (Markdown, Vue, Svelte, Astro): report every occurrence.
			report.manual.push(...toManual(rel(file), residualScan(text, []), text, []));
		}
	}

	for (const group of createProjects(candidates).values()) {
		if (group.configError && group.config) {
			skip(
				group.config,
				`Could not load this config (${group.configError}); its files were analyzed with default options, so path aliases from it were not applied.`
			);
		}
		for (const file of group.files) {
			try {
				const sf = group.project.getSourceFileOrThrow(file);
				const raw = readFileSync(file, "utf8");
				const bom = raw.startsWith("\uFEFF") ? "\uFEFF" : "";
				const text = sf.getFullText();
				const syntaxErrors = group.project.getProgram().getSyntacticDiagnostics(sf);
				if (syntaxErrors.length > 0) {
					const first = syntaxErrors[0]!;
					const message = first.getMessageText();
					skip(
						file,
						`Syntax error at line ${first.getLineNumber() ?? "?"}: ${(typeof message === "string" ? message : message.getMessageText()).replace(/\.$/, "")}. Not transformed; leftovers are listed as manual items.`
					);
					report.manual.push(...toManual(rel(file), residualScan(text, []), text, []));
					continue;
				}
				const { edits, manual, explained } = analyzeFile(sf);
				const output = applyEdits(text, edits);
				const pending = [...manual, ...residualScan(text, [...edits, ...explained])];
				const fileManual = toManual(rel(file), pending, output, edits);
				const fileChanges = edits.length > 0 ? toChanges(rel(file), text, edits) : [];
				// Only now that the whole file succeeded does it reach the report.
				report.manual.push(...fileManual);
				if (edits.length === 0) continue;
				report.changes.push(...fileChanges);
				outputs.set(rel(file), output);
				writes.push({ file, content: bom + output });
			} catch (error) {
				skip(
					file,
					`The codemod failed while analyzing this file (${errorMessage(error)}). Not transformed; check it by hand and please report the error.`
				);
			}
		}
	}

	if (write) for (const { file, content } of writes) writeFileSync(file, content);

	report.environment = checkEnvironment(files, cwd);
	report.changes.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
	report.manual.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column);
	return { report, outputs, scanned: files.length };
}
