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
	await page.goto("/routes");
	await page.getByRole("button", { name: "Increment route counter" }).click();
	await expect(page.getByTestId("counter-hook-result")).toContainText('"count": 1');
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
	expect((await request.get("/routes")).ok()).toBe(true);
});

test("browser fetch with cookies and Origin succeeds while foreign origins and GET are rejected", async ({ page }) => {
	await page.goto("/routes");
	const status = await page.evaluate(async () => {
		const response = await fetch("/api/routes/counter", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ amount: 4 }),
		});
		return { status: response.status, body: await response.json() };
	});
	expect(status).toEqual({ status: 200, body: { data: { count: 4 } } });
	const foreign = await page.request.post("/api/routes/counter", {
		data: { amount: 1 },
		headers: { origin: "https://evil.example" },
	});
	expect(foreign.status()).toBe(403);
	expect(await foreign.json()).toEqual({ httpError: { code: "ORIGIN_NOT_ALLOWED", message: "Origin is not allowed" } });
	expect((await page.request.get("/api/routes/counter")).status()).toBe(405);
	const follow = await page.request.post("/api/routes/counter", { data: { amount: 1 } });
	expect(await follow.json()).toEqual({ data: { count: 5 } });
});

test("the OpenAPI route documents every registered operation", async ({ request }) => {
	const response = await request.get("/api/openapi.json");
	expect(response.status()).toBe(200);
	const document = await response.json();
	expect(document.openapi).toBe("3.1.1");
	const operationIds = Object.values(document.paths).flatMap((operations) =>
		Object.values(operations as Record<string, { operationId: string }>).map((operation) => operation.operationId)
	);
	expect(operationIds.toSorted()).toEqual(
		["addToTotal", "createReport", "incrementCounter", "reserveUsername", "updateTodo"].toSorted()
	);
	expect((await request.get("/api/docs")).headers()["content-type"]).toContain("text/html");
});

test("mapInput merges the path parameter over the body", async ({ request }) => {
	const response = await request.patch("/api/routes/todos/7", { data: { id: "999", title: "Ship it" } });
	expect(response.status()).toBe(200);
	expect(await response.json()).toEqual({ data: { id: "7", title: "Ship it" } });
	const invalid = await request.patch("/api/routes/todos/7", { data: { title: "" } });
	expect(invalid.status()).toBe(400);
	expect(await invalid.json()).toHaveProperty("validationErrors.title");
});

test("serverErrorStatus maps an expected server error to 409", async ({ request }) => {
	const created = await request.post("/api/routes/usernames", { data: { username: "ada" } });
	expect(created.status()).toBe(201);
	expect(await created.json()).toEqual({ data: { username: "ada" } });
	const taken = await request.post("/api/routes/usernames", { data: { username: "admin" } });
	expect(taken.status()).toBe(409);
	expect(await taken.json()).toEqual({ serverError: "Username is already taken" });
});

test("stateful routes accept a prevResult envelope", async ({ request }) => {
	const first = await request.post("/api/routes/total", { data: { input: { amount: 5 } } });
	expect(await first.json()).toEqual({ data: { total: 5 } });
	const second = await request.post("/api/routes/total", {
		data: { input: { amount: 5 }, prevResult: { data: { total: 5 } } },
	});
	expect(await second.json()).toEqual({ data: { total: 10 } });
	expect((await request.post("/api/routes/total", { data: { amount: 5 } })).status()).toBe(400);
});

test("auth middleware rejects requests without a valid API key", async ({ page }) => {
	const missing = await page.request.post("/api/routes/reports", { data: { title: "Q3" } });
	expect(missing.status()).toBe(401);
	expect(await missing.json()).toEqual({ httpError: { code: "UNAUTHORIZED", message: "Unauthorized" } });
	const wrong = await page.request.post("/api/routes/reports", {
		data: { title: "Q3" },
		headers: { "x-api-key": "nope" },
	});
	expect(wrong.status()).toBe(401);
	await page.goto("/routes");
	await page.getByRole("button", { name: "POST /reports (x-api-key: demo-key)" }).click();
	await expect(page.getByTestId("report-http-result")).toContainText("Response: HTTP 201");
	await expect(page.getByTestId("report-http-result")).toContainText('"createdBy": "demo-client"');
});
