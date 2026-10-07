import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ADAPTERS, ENV_REQUIREMENTS, NSA_PACKAGE } from "./rules";

export type EnvStatus = "ok" | "upgrade" | "unknown";

export type EnvItem = {
	rule: "V9-04";
	file: string;
	package: string;
	found: string;
	required: string;
	status: EnvStatus;
	fix: string;
};

type Version = [number, number, number, boolean]; // major, minor, patch, isPrerelease

const num = (part: string | undefined) => (part === undefined || part === "x" || part === "*" ? 0 : Number(part));

function parseVersion(value: string): Version | undefined {
	const match = /^v?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?(-[0-9A-Za-z.-]+)?/.exec(value.trim());
	if (!match) return undefined;
	return [num(match[1]), num(match[2]), num(match[3]), match[4] !== undefined];
}

/** Lowest version a dependency range allows, or `undefined` when it cannot be read (workspace:, tags, unions...). */
export function minVersion(range: string): Version | undefined {
	const value = range.trim();
	if (value === "" || /^[a-z-]+:/i.test(value) || /\|\||\s-\s|^</.test(value) || /^>(?!=)/.test(value))
		return undefined;
	return parseVersion(value.replace(/^(?:\^|~|>=|=)\s*/, ""));
}

/** a >= b, where a prerelease of b counts as lower. */
function satisfies(a: Version, b: Version): boolean {
	for (let i = 0; i < 3; i++) {
		if (a[i] !== b[i]) return (a[i] as number) > (b[i] as number);
	}
	return !a[3] || b[3];
}

function readJson(file: string): Record<string, unknown> | undefined {
	try {
		return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
	} catch {
		return undefined;
	}
}

/** Installed package.json of `pkg`, resolved like Node does (walking up node_modules). */
function installedManifest(fromDir: string, pkg: string): Record<string, unknown> | undefined {
	let dir = fromDir;
	for (;;) {
		const manifest = path.join(dir, "node_modules", pkg, "package.json");
		if (existsSync(manifest)) return readJson(manifest);
		const parent = path.dirname(dir);
		if (parent === dir) return undefined;
		dir = parent;
	}
}

const LOCKFILES: [string, string][] = [
	["pnpm-lock.yaml", "pnpm add"],
	["package-lock.json", "npm install"],
	["yarn.lock", "yarn add"],
	["bun.lock", "bun add"],
	["bun.lockb", "bun add"],
];

export function installCommand(fromDir: string): string {
	let dir = fromDir;
	for (;;) {
		for (const [lockfile, command] of LOCKFILES) {
			if (existsSync(path.join(dir, lockfile))) return command;
		}
		const parent = path.dirname(dir);
		if (parent === dir) return "npm install";
		dir = parent;
	}
}

const record = (deps: unknown): Record<string, string> =>
	deps && typeof deps === "object" ? (deps as Record<string, string>) : {};

const NEXT_FIX = "Upgrade Next.js to 15.1.0 or later, for example with `npx @next/codemod@latest upgrade latest`.";
const REACT_FIX = "Upgrade react and react-dom to 19 or later (the Next.js upgrade codemod does this).";

/** V9-04: environment checks. Reports only, never writes package.json. */
export function checkEnvironment(files: string[], cwd: string): EnvItem[] {
	const items: EnvItem[] = [];
	const rel = (file: string) => path.relative(cwd, file) || ".";
	const versionCheck = (version: Version | undefined, required: string): EnvStatus =>
		version === undefined ? "unknown" : satisfies(version, parseVersion(required)!) ? "ok" : "upgrade";

	for (const file of files.filter((f) => path.basename(f) === "package.json")) {
		const manifest = readJson(file);
		if (!manifest) continue;
		const deps = { ...record(manifest.devDependencies), ...record(manifest.dependencies) };
		if (![NSA_PACKAGE, ...ADAPTERS].some((name) => name in deps)) continue;
		const dir = path.dirname(file);
		const install = installCommand(dir);
		const where = rel(dir) === "." ? "" : ` in ${rel(dir)}`;

		for (const pkg of [NSA_PACKAGE, "next", "react", "react-dom"] as const) {
			const declared = deps[pkg];
			if (declared === undefined) continue;
			const installed = installedManifest(dir, pkg)?.version;
			const found = typeof installed === "string" ? `${installed} (installed)` : `${declared} (declared)`;
			const version = typeof installed === "string" ? parseVersion(installed) : minVersion(declared);
			const required = ENV_REQUIREMENTS[pkg];
			const status = versionCheck(version, required);
			const fix =
				status === "unknown"
					? `Could not read a version from "${declared}"; make sure it resolves to ${pkg} ${required} or later.`
					: pkg === NSA_PACKAGE
						? `Run \`${install} ${NSA_PACKAGE}@latest\`${where}.`
						: pkg === "next"
							? NEXT_FIX
							: REACT_FIX;
			items.push({ rule: "V9-04", file: rel(file), package: pkg, found, required: `>=${required}`, status, fix });
		}

		for (const adapter of ADAPTERS) {
			const declared = deps[adapter];
			if (declared === undefined) continue;
			const installed = installedManifest(dir, adapter);
			const peer = record(installed?.peerDependencies)[NSA_PACKAGE];
			const peerMin = peer === undefined ? undefined : minVersion(peer);
			const status: EnvStatus =
				peerMin === undefined
					? "unknown"
					: satisfies(peerMin, parseVersion(ENV_REQUIREMENTS[NSA_PACKAGE])!)
						? "ok"
						: "upgrade";
			items.push({
				rule: "V9-04",
				file: rel(file),
				package: adapter,
				found:
					typeof installed?.version === "string"
						? `${installed.version} (installed, peer next-safe-action ${peer ?? "unknown"})`
						: `${declared} (declared)`,
				required: "a release with peer next-safe-action >=9.0.0",
				status,
				fix:
					status === "unknown"
						? `Could not confirm a next-safe-action v9 compatible release (not installed, or the version is not readable); run \`${install} ${adapter}@latest\`${where}.`
						: `Run \`${install} ${adapter}@latest\`${where}.`,
			});
		}

		const engines = record(manifest.engines).node;
		if (engines !== undefined) {
			items.push({
				rule: "V9-04",
				file: rel(file),
				package: "node",
				found: `engines.node ${engines}`,
				required: `>=${ENV_REQUIREMENTS.node}`,
				status: versionCheck(minVersion(engines), ENV_REQUIREMENTS.node),
				fix: `Raise \`engines.node\` to ">=${ENV_REQUIREMENTS.node}" or later.`,
			});
		}
	}

	for (const file of files.filter((f) => [".nvmrc", ".node-version"].includes(path.basename(f)))) {
		const value = readFileSync(file, "utf8").trim().split(/\s/)[0] ?? "";
		items.push({
			rule: "V9-04",
			file: rel(file),
			package: "node",
			found: value,
			required: `>=${ENV_REQUIREMENTS.node}`,
			status: versionCheck(parseVersion(value), ENV_REQUIREMENTS.node),
			fix: `Pin Node.js ${ENV_REQUIREMENTS.node} or later in ${path.basename(file)}.`,
		});
	}

	items.push({
		rule: "V9-04",
		file: "(current Node.js runtime)",
		package: "node",
		found: process.version,
		required: `>=${ENV_REQUIREMENTS.node}`,
		status: versionCheck(parseVersion(process.version), ENV_REQUIREMENTS.node),
		fix: `Use Node.js ${ENV_REQUIREMENTS.node} or later.`,
	});
	return items;
}
