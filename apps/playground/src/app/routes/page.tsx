import { BookOpenIcon, BracesIcon } from "lucide-react";
import { CodeViewer } from "@/components/code-viewer";
import { ExampleCard } from "@/components/example-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { readAndHighlightFile } from "@/lib/shiki";
import { CounterDemo } from "./_components/counter-demo";
import { HttpDemo } from "./_components/http-demo";
import { RunningTotalDemo } from "./_components/running-total-demo";

export default async function RoutesPage() {
	const [
		router,
		subrouters,
		client,
		handler,
		openapi,
		counter,
		updateTodo,
		reserveUsername,
		runningTotal,
		createReport,
	] = await Promise.all([
		readAndHighlightFile("routes/_lib/router.ts"),
		readAndHighlightFile("routes/_lib/subrouters.ts"),
		readAndHighlightFile("routes/_lib/route-client.ts"),
		readAndHighlightFile("api/routes/[[...path]]/route.ts"),
		readAndHighlightFile("api/openapi.json/route.ts"),
		readAndHighlightFile("routes/_actions/counter-action.ts"),
		readAndHighlightFile("routes/_actions/update-todo-action.ts"),
		readAndHighlightFile("routes/_actions/reserve-username-action.ts"),
		readAndHighlightFile("routes/_actions/running-total-action.ts"),
		readAndHighlightFile("routes/_actions/create-report-action.ts"),
	]);

	return (
		<div>
			<PageHeader
				title="Route Handlers"
				description="Expose selected actions as JSON endpoints with @next-safe-action/adapter-routes, and document them with OpenAPI."
			/>
			<div className="space-y-6">
				<ExampleCard
					title="Setup"
					description="Actions stay ordinary actions. A router maps them to HTTP methods and paths, and the same router feeds the [[...path]] catch-all route and the OpenAPI document."
				>
					<div className="space-y-4">
						{[
							{ label: "Router: HTTP methods, paths, per-route options and merged subrouters", source: router },
							{ label: "Action clients, with auth middleware", source: client },
							{ label: "Catch-all route handler: /api/routes/[[...path]]", source: handler },
							{ label: "OpenAPI document: GET /api/openapi.json", source: openapi },
						].map(({ label, source }) => (
							<div key={label} className="space-y-1">
								<p className="text-sm font-medium">{label}</p>
								<CodeViewer {...source} />
							</div>
						))}
						<div className="flex flex-wrap gap-2">
							<Button asChild>
								<a href="/api/docs" target="_blank" rel="noopener noreferrer">
									<BookOpenIcon />
									Open API reference
								</a>
							</Button>
							<Button asChild variant="outline">
								<a href="/api/openapi.json" target="_blank" rel="noopener noreferrer">
									<BracesIcon />
									openapi.json
								</a>
							</Button>
						</div>
					</div>
				</ExampleCard>
				<CounterDemo source={counter} />
				<HttpDemo
					title="Path parameters with mapInput"
					description="PATCH /todos/{id}: mapInput merges the id from the URL into the JSON body before validation. The URL wins over an id in the body."
					source={updateTodo}
					testId="todo-http-result"
					requests={[
						{
							label: "PATCH /todos/1",
							request: { method: "PATCH", path: "/todos/1", body: { title: "Write docs", done: true } },
						},
						{
							label: "PATCH /todos/2 (body id ignored)",
							request: { method: "PATCH", path: "/todos/2", body: { id: "999", done: false } },
						},
					]}
				/>
				<HttpDemo
					title="Subrouters"
					description="createRouter({ prefix }) groups the routes of a feature, and mergeRouters() combines the subrouters in router.ts. The prefix /orgs/{orgId} has a parameter, so mapInput is required and params.orgId is typed."
					source={subrouters}
					testId="subrouter-http-result"
					requests={[
						{
							label: "POST /todos",
							request: { method: "POST", path: "/todos", body: { title: "Try subrouters" } },
						},
						{
							label: "POST /orgs/acme/invites (body orgId ignored)",
							request: {
								method: "POST",
								path: "/orgs/acme/invites",
								body: { orgId: "other", email: "ada@example.com" },
							},
						},
						{
							label: "POST /orgs/acme/invites (invalid email)",
							request: { method: "POST", path: "/orgs/acme/invites", body: { email: "not-an-email" } },
						},
					]}
				/>
				<HttpDemo
					title="Server error status mapping"
					description="returnServerError sends an expected error. serverErrorStatus maps it to 409 instead of the default 500. Success uses successStatus 201."
					source={reserveUsername}
					testId="username-http-result"
					requests={[
						{
							label: "POST /usernames (ada)",
							request: { method: "POST", path: "/usernames", body: { username: "ada" } },
						},
						{
							label: "POST /usernames (admin, taken)",
							request: { method: "POST", path: "/usernames", body: { username: "admin" } },
						},
					]}
				/>
				<RunningTotalDemo source={runningTotal} />
				<HttpDemo
					title="Authentication middleware"
					description="apiKeyClient checks the x-api-key header in middleware (see the Setup card). Without a valid key, unauthorized() becomes a 401 response."
					source={createReport}
					testId="report-http-result"
					requests={[
						{ label: "POST /reports (no key)", request: { method: "POST", path: "/reports", body: { title: "Q3" } } },
						{
							label: "POST /reports (x-api-key: demo-key)",
							request: {
								method: "POST",
								path: "/reports",
								body: { title: "Q3" },
								headers: { "x-api-key": "demo-key" },
							},
						},
					]}
				/>
			</div>
		</div>
	);
}
