import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

test("imported server actions retain route definitions and cookie access", async ({ request }) => {
	const first = await request.post("/api/routes/counter", { data: { amount: 2 } });
	expect(first.status()).toBe(200);
	expect(await first.json()).toEqual({ data: { count: 2 } });
	expect(first.headers()["set-cookie"]).toContain("route-counter=2");
	const second = await request.post("/api/routes/counter", { data: { amount: 3 } });
	expect(await second.json()).toEqual({ data: { count: 5 } });
	expect((await request.put("/api/routes/counter", { data: {} })).status()).toBe(405);
	expect((await request.post("/api/routes/missing", { data: {} })).status()).toBe(404);
});

test("the same route action remains usable through useAction", async ({ page }) => {
	await page.goto("/hooks");
	await page.getByRole("button", { name: "Increment route counter" }).click();
	await expect(page.locator('div[aria-live="polite"]')).toContainText('"count": 1');
	const response = await page.request.post("/api/routes/counter", { data: { amount: 2 } });
	expect(await response.json()).toEqual({ data: { count: 3 } });
});

test("client JavaScript excludes route descriptors and OpenAPI generation", async ({ request }) => {
	// Check emitted files rather than the RSC payload, which can contain server-rendered source examples.
	const root = join(process.cwd(), ".next/static");
	for (const file of await readdir(root, { recursive: true })) {
		if (!file.endsWith(".js")) continue;
		const source = await readFile(join(root, file), "utf8");
		expect(source).not.toContain("next-safe-action.adapter-routes.v1");
		expect(source).not.toContain("next-safe-action.onActionDefined.v1");
		expect(source).not.toContain("next-safe-action.invalid/schemas/");
	}
	expect((await request.get("/hooks")).ok()).toBe(true);
});
