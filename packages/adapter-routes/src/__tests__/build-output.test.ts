import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, expect, test } from "vitest";

const packageRoot = path.resolve(fileURLToPath(import.meta.url), "../../..");
const outDir = mkdtempSync(path.join(tmpdir(), "adapter-routes-build-"));

afterAll(() => {
	rmSync(outDir, { recursive: true, force: true });
});

// The core package must stay a single external import in both entries: the `Symbol.for` descriptor protocol and
// `instanceof` checks depend on the host application's copy of next-safe-action. Bundling or rewriting the specifier
// would create a duplicate core instance. See https://github.com/next-safe-action/next-safe-action/issues/476 for
// the related `resolveDepSubpath` regression.
test("keeps next-safe-action external and specifiers unrewritten in both entries", { timeout: 120_000 }, () => {
	execFileSync(path.join(packageRoot, "node_modules/.bin/tsdown"), ["--out-dir", outDir, "--no-dts"], {
		cwd: packageRoot,
		stdio: "ignore",
	});
	const files = readdirSync(outDir).filter((file) => file.endsWith(".mjs"));
	expect(files).toEqual(expect.arrayContaining(["index.mjs", "openapi.mjs"]));
	const bundles = files.map((file) => readFileSync(path.join(outDir, file), "utf8"));
	// Shared code may land in a chunk, so the external import is asserted across the whole output.
	expect(bundles.join("\n")).toContain('from "next-safe-action"');
	for (const bundle of bundles) {
		expect(bundle).not.toMatch(/from "next-safe-action\/[^"]+"/);
		expect(bundle).not.toMatch(/from "next\/[^"]+\.js"/);
	}
	// Source maps list every bundled module: all of them must come from this package's own sources.
	for (const file of files) {
		const map = JSON.parse(readFileSync(path.join(outDir, file + ".map"), "utf8")) as { sources: string[] };
		expect(map.sources.length).toBeGreaterThan(0);
		for (const source of map.sources) {
			expect(path.resolve(outDir, source).startsWith(path.join(packageRoot, "src") + path.sep)).toBe(true);
		}
	}
});
