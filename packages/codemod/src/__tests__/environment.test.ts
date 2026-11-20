import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "vitest";
import { checkEnvironment, minVersion } from "../environment";
import { writeFiles } from "./helpers";

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("reads the lowest version a range allows", () => {
	expect(minVersion("^15.1.0")).toEqual([15, 1, 0, false]);
	expect(minVersion(">= 19")).toEqual([19, 0, 0, false]);
	expect(minVersion("~8.4.x")).toEqual([8, 4, 0, false]);
	expect(minVersion("15.1.0-canary.3")).toEqual([15, 1, 0, true]);
	for (const unreadable of ["workspace:*", "catalog:", "latest", "npm:next@15", "^14 || ^15", ">15.0.0", "<16", ""]) {
		expect(minVersion(unreadable), unreadable).toBeUndefined();
	}
});

test("prefers the installed version and the installed adapter's peer range", () => {
	const dir = mkdtempSync(path.join(tmpdir(), "nsa-codemod-env-"));
	dirs.push(dir);
	writeFiles(dir, {
		"package.json": JSON.stringify({
			dependencies: {
				"next": "^15.0.0",
				"next-safe-action": "^8.0.0",
				"@next-safe-action/adapter-tanstack-query": "^0.1.0",
				"@next-safe-action/adapter-better-auth": "^0.1.0",
			},
		}),
		"package-lock.json": "{}",
		"node_modules/next/package.json": JSON.stringify({ version: "15.0.3" }),
		"node_modules/next-safe-action/package.json": JSON.stringify({ version: "9.0.0" }),
		"node_modules/@next-safe-action/adapter-tanstack-query/package.json": JSON.stringify({
			version: "0.1.0",
			peerDependencies: { "next-safe-action": ">= 8.0.0" },
		}),
		"node_modules/@next-safe-action/adapter-better-auth/package.json": JSON.stringify({
			version: "0.2.0",
			peerDependencies: { "next-safe-action": ">= 9.0.0" },
		}),
	});
	const items = checkEnvironment([path.join(dir, "package.json")], dir)
		.filter((i) => i.file === "package.json")
		.map(({ package: pkg, found, status, fix }) => ({ pkg, found, status, fix }));
	expect(items).toEqual([
		{
			pkg: "next-safe-action",
			found: "9.0.0 (installed)",
			status: "ok",
			fix: "",
		},
		{
			pkg: "next",
			found: "15.0.3 (installed)",
			status: "upgrade",
			fix: "Upgrade Next.js to 15.1.0 or later, for example with `npx @next/codemod@latest upgrade latest`.",
		},
		{
			pkg: "@next-safe-action/adapter-tanstack-query",
			found: "0.1.0 (installed, peer next-safe-action >= 8.0.0)",
			status: "upgrade",
			fix: "Run `npm install @next-safe-action/adapter-tanstack-query@latest`.",
		},
		{
			pkg: "@next-safe-action/adapter-better-auth",
			found: "0.2.0 (installed, peer next-safe-action >= 9.0.0)",
			status: "ok",
			fix: "",
		},
	]);
});

test("reports an unknown dependency check when no package.json is in the scanned files", () => {
	const dir = mkdtempSync(path.join(tmpdir(), "nsa-codemod-env-"));
	dirs.push(dir);
	writeFiles(dir, { "src/a.ts": "export {};\n" });
	const items = checkEnvironment([path.join(dir, "src/a.ts")], dir);
	expect(items.find((i) => i.file === "(not found)")).toMatchObject({
		package: "next-safe-action",
		found: "no package.json in scanned paths",
		status: "unknown",
	});
	expect(items.every((i) => i.status !== "ok" || i.fix === "")).toBe(true);
});

test("a package.json that does not depend on next-safe-action still counts as not found", () => {
	const dir = mkdtempSync(path.join(tmpdir(), "nsa-codemod-env-"));
	dirs.push(dir);
	writeFiles(dir, { "package.json": JSON.stringify({ dependencies: { next: "^15.1.0" } }) });
	const items = checkEnvironment([path.join(dir, "package.json")], dir);
	expect(items.some((i) => i.file === "(not found)")).toBe(true);
});
