import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cacheLife } from "next/cache";
import { codeToHtml } from "shiki";

export type SourceCode = {
	code: string;
	html: string;
	url: string;
	filename: string;
};

const GITHUB_BASE = "https://github.com/next-safe-action/next-safe-action/blob/main/apps/playground/src/app/";

/**
 * Read a file relative to the `src/app/` directory, highlight it with Shiki,
 * and return the raw code, highlighted HTML, GitHub URL, and filename.
 */
export async function readAndHighlightFile(appRelativePath: string): Promise<SourceCode> {
	"use cache";
	cacheLife("max");

	const absolutePath = join(process.cwd(), "src/app", appRelativePath);
	const code = readFileSync(absolutePath, "utf-8");

	const html = await codeToHtml(code, {
		lang: "typescript",
		themes: {
			light: "github-light",
			dark: "github-dark",
		},
		defaultColor: false,
	});

	const url = `${GITHUB_BASE}${appRelativePath}`;
	const filename = appRelativePath.split("/").pop()!;

	return { code, html, url, filename };
}
