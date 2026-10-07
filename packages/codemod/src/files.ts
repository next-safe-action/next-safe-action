import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { CODE_EXTENSIONS, IGNORED_DIRS, TEXT_EXTENSIONS } from "./rules";

const ENV_FILES = ["package.json", ".nvmrc", ".node-version"];

const git = (cwd: string, args: string[]) =>
	execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1024 ** 3 });

/** Returns the porcelain status of the repo containing `dir`, or `undefined` when it is not a git repo. */
export function gitStatus(dir: string): string | undefined {
	try {
		return git(dir, ["status", "--porcelain"]);
	} catch {
		return undefined;
	}
}

const isIgnored = (file: string) => file.split(/[\\/]/).some((segment) => IGNORED_DIRS.includes(segment));

export const isCodeFile = (file: string) => CODE_EXTENSIONS.some((ext) => file.endsWith(ext));

const inScope = (file: string) =>
	isCodeFile(file) || TEXT_EXTENSIONS.some((ext) => file.endsWith(ext)) || ENV_FILES.includes(path.basename(file));

const isRegularFile = (file: string) => existsSync(file) && lstatSync(file).isFile();

function walk(dir: string, out: string[]) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (IGNORED_DIRS.includes(entry.name)) continue;
		const full = path.join(dir, entry.name);
		// Symlinks are skipped on purpose: they can loop, and their targets are scanned on their own.
		if (entry.isDirectory()) walk(full, out);
		else if (entry.isFile()) out.push(full);
	}
}

/**
 * Lists the in-scope files under each path (absolute). Inside a git repo it honors `.gitignore`
 * (tracked plus untracked, non-ignored files); elsewhere it walks the tree. Default ignored
 * directories are dropped either way. A path that names a file is always included.
 */
export function listFiles(paths: string[]): string[] {
	const files = new Set<string>();
	for (const p of paths) {
		const abs = path.resolve(p);
		if (!existsSync(abs)) throw new Error(`Path not found: ${p}`);
		if (statSync(abs).isFile()) {
			files.add(abs);
			continue;
		}
		let found: string[];
		try {
			found = git(abs, ["ls-files", "-co", "--exclude-standard", "-z", "--", "."])
				.split("\0")
				.filter(Boolean)
				.map((f) => path.join(abs, f));
		} catch {
			found = [];
			walk(abs, found);
		}
		// `git ls-files` lists symlinks too: skip them, so a write can never follow one out of the project.
		for (const f of found) {
			if (!isIgnored(path.relative(abs, f)) && inScope(f) && isRegularFile(f)) files.add(f);
		}
	}
	return [...files].sort();
}
