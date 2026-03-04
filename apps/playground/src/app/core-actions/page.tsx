"use client";

import { useState } from "react";
import { ExampleCard } from "@/components/example-card";
import { PageHeader } from "@/components/page-header";
import { ResultDisplay } from "@/components/result-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { asyncSchemaAction } from "./_actions/async-schema-action";
import { authContextAction } from "./_actions/auth-context-action";
import { directAction } from "./_actions/direct-action";
import { emptyResponseAction } from "./_actions/empty-response-action";
import { noArgsAction } from "./_actions/no-args-action";
import { outputSchemaAction } from "./_actions/output-schema-action";

export default function CoreActionsPage() {
	const [directResult, setDirectResult] = useState<unknown>(undefined);
	const [asyncResult, setAsyncResult] = useState<unknown>(undefined);
	const [authResult, setAuthResult] = useState<unknown>(undefined);
	const [noArgsResult, setNoArgsResult] = useState<unknown>(undefined);
	const [emptyResult, setEmptyResult] = useState<unknown>(undefined);
	const [outputResult, setOutputResult] = useState<unknown>(undefined);

	return (
		<div>
			<PageHeader
				title="Core Actions"
				description="Basic action patterns: direct calls, async schemas, auth context, and output validation."
			/>
			<div className="space-y-6">
				<ExampleCard title="Direct Call" description="Basic action with inputSchema, invoked directly with useState.">
					<form
						className="space-y-4"
						onSubmit={async (e) => {
							e.preventDefault();
							const formData = new FormData(e.currentTarget);
							const res = await directAction({
								username: formData.get("username") as string,
								password: formData.get("password") as string,
							});
							setDirectResult(res);
						}}
					>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="direct-username">Username</Label>
								<Input id="direct-username" name="username" placeholder="user" />
							</div>
							<div className="space-y-2">
								<Label htmlFor="direct-password">Password</Label>
								<Input id="direct-password" name="password" type="password" placeholder="password" />
							</div>
						</div>
						<Button type="submit">Execute</Button>
					</form>
					<ResultDisplay result={directResult} />
				</ExampleCard>

				<ExampleCard
					title="Async Schema"
					description="inputSchema with an async factory function — schema is resolved at runtime."
				>
					<form
						className="space-y-4"
						onSubmit={async (e) => {
							e.preventDefault();
							const formData = new FormData(e.currentTarget);
							const res = await asyncSchemaAction({
								username: formData.get("username") as string,
								password: formData.get("password") as string,
							});
							setAsyncResult(res);
						}}
					>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="async-username">Username</Label>
								<Input id="async-username" name="username" placeholder="user" />
							</div>
							<div className="space-y-2">
								<Label htmlFor="async-password">Password</Label>
								<Input id="async-password" name="password" type="password" placeholder="password" />
							</div>
						</div>
						<Button type="submit">Execute</Button>
					</form>
					<ResultDisplay result={asyncResult} />
				</ExampleCard>

				<ExampleCard
					title="Auth Context"
					description="authAction with chained .use() middleware — ctx.userId and ctx.sessionId available in the action."
				>
					<form
						className="space-y-4"
						onSubmit={async (e) => {
							e.preventDefault();
							const formData = new FormData(e.currentTarget);
							const res = await authContextAction({
								fullName: formData.get("fullName") as string,
								age: formData.get("age") as string,
							});
							setAuthResult(res);
						}}
					>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="auth-fullName">Full Name</Label>
								<Input id="auth-fullName" name="fullName" placeholder="Jane Doe" />
							</div>
							<div className="space-y-2">
								<Label htmlFor="auth-age">Age</Label>
								<Input id="auth-age" name="age" placeholder="25" />
							</div>
						</div>
						<Button type="submit">Execute</Button>
					</form>
					<ResultDisplay result={authResult} />
				</ExampleCard>

				<ExampleCard title="No Arguments" description="Action without an input schema — just call it.">
					<Button
						onClick={async () => {
							const res = await noArgsAction();
							setNoArgsResult(res);
						}}
					>
						Execute
					</Button>
					<ResultDisplay result={noArgsResult} />
				</ExampleCard>

				<ExampleCard
					title="Empty Response"
					description="Action that returns void — useful for side-effect-only operations."
				>
					<form
						className="space-y-4"
						onSubmit={async (e) => {
							e.preventDefault();
							const formData = new FormData(e.currentTarget);
							const res = await emptyResponseAction({
								userId: formData.get("userId") as string,
							});
							setEmptyResult(res);
						}}
					>
						<div className="space-y-2">
							<Label htmlFor="empty-userId">User ID (UUID)</Label>
							<Input id="empty-userId" name="userId" placeholder="Enter a UUID" />
						</div>
						<Button type="submit">Execute</Button>
					</form>
					<ResultDisplay result={emptyResult} />
				</ExampleCard>

				<ExampleCard
					title="Output Schema"
					description="Using .outputSchema() to validate the return data from the action."
				>
					<form
						className="space-y-4"
						onSubmit={async (e) => {
							e.preventDefault();
							const formData = new FormData(e.currentTarget);
							const res = await outputSchemaAction({
								name: formData.get("name") as string,
							});
							setOutputResult(res);
						}}
					>
						<div className="space-y-2">
							<Label htmlFor="output-name">Name</Label>
							<Input id="output-name" name="name" placeholder="World" />
						</div>
						<Button type="submit">Execute</Button>
					</form>
					<ResultDisplay result={outputResult} />
				</ExampleCard>
			</div>
		</div>
	);
}
