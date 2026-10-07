import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import {
	ADAPTERS,
	CLIENT_CHAIN_METHODS,
	ENV_REQUIREMENTS,
	REMOVED_ENTRY,
	REPLACEMENT_ENTRY,
	RULES,
	TYPE_RENAMES,
} from "../rules";

// Guards the rename table and requirements against the core package in this repo.
const ROOT = path.join(import.meta.dirname, "../../../..");
const core = (file: string) => readFileSync(path.join(ROOT, "packages/next-safe-action", file), "utf8");
const exportsType = (source: string, name: string) => new RegExp(`export type ${name}\\b`).test(source);

test("old type names are gone from core and the new names exist in the same entry", () => {
	const sources = {
		"next-safe-action": core("src/index.types.ts"),
		"next-safe-action/hooks": core("src/hooks.types.ts"),
	};
	for (const { from, to, module } of TYPE_RENAMES) {
		for (const source of Object.values(sources)) expect(exportsType(source, from), from).toBe(false);
		expect(exportsType(sources[module], to), `${to} in ${module}`).toBe(true);
	}
});

test("the stateful-hooks entry is gone and the hooks entry exists", () => {
	const exportsField = JSON.parse(core("package.json")).exports as Record<string, unknown>;
	expect(Object.keys(exportsField)).toContain(`./${REPLACEMENT_ENTRY.split("/")[1]}`);
	expect(Object.keys(exportsField)).not.toContain(`./${REMOVED_ENTRY.split("/")[1]}`);
});

test("client chain methods match the SafeActionClient methods", () => {
	const source = core("src/safe-action-client.ts");
	const methods = [...source.matchAll(/^\t([a-zA-Z]+)[<(]/gm)].map((m) => m[1]!);
	const chain = methods.filter((m) => m !== "constructor" && m !== "action" && m !== "stateAction");
	expect(new Set([...chain, "schema"])).toEqual(CLIENT_CHAIN_METHODS);
	expect(source).not.toMatch(/^\tschema\b/m);
});

test("environment requirements match the core and adapter manifests", () => {
	const manifest = JSON.parse(core("package.json"));
	expect(manifest.peerDependencies.next).toBe(`>= ${ENV_REQUIREMENTS.next}`);
	expect(manifest.peerDependencies.react).toBe(`>= ${ENV_REQUIREMENTS.react}`);
	expect(manifest.peerDependencies["react-dom"]).toBe(`>= ${ENV_REQUIREMENTS["react-dom"]}`);
	expect(`${manifest.engines.node}.0`).toBe(`>=${ENV_REQUIREMENTS.node}`);
	expect(Number(manifest.version.split(".")[0]) <= 9).toBe(true);
	for (const adapter of ADAPTERS) {
		const adapterManifest = JSON.parse(
			readFileSync(path.join(ROOT, "packages", adapter.replace("@next-safe-action/", ""), "package.json"), "utf8")
		);
		expect(adapterManifest.peerDependencies["next-safe-action"], adapter).toBe(
			`>= ${ENV_REQUIREMENTS["next-safe-action"]}`
		);
	}
});

const GUIDE = path.join(ROOT, "apps/docs/content/docs/migrations/v8-to-v9.mdx");

test.skipIf(!existsSync(GUIDE))("every rule id is documented in the migration guide", () => {
	const guide = readFileSync(GUIDE, "utf8").toLowerCase();
	for (const [id, rule] of Object.entries(RULES)) {
		expect(guide, id).toContain(id.toLowerCase());
		expect(rule.docs.endsWith(`#${id.toLowerCase()}`)).toBe(true);
	}
});
