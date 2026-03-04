"use client";

import { useAction } from "next-safe-action/hooks";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { onboardUser } from "../_actions/onboard-action";

type Props = {
	age: number;
	userId: string;
};

export function BindArgumentsDemo({ age, userId }: Props) {
	const boundOnboardUser = onboardUser.bind(null, userId, age);
	const { execute, result, status, reset } = useAction(boundOnboardUser);

	return (
		<ExampleCard
			title="Bind Arguments"
			description={`Server-generated bind args: userId=${userId.slice(0, 8)}..., age=${age}. These are validated by bindArgsSchemas.`}
		>
			<form
				className="space-y-4"
				onSubmit={(e) => {
					e.preventDefault();
					const formData = new FormData(e.currentTarget);
					execute({ username: formData.get("username") as string });
				}}
			>
				<div className="space-y-2">
					<Label htmlFor="bind-username">Username</Label>
					<Input id="bind-username" name="username" placeholder="Enter username" />
				</div>
				<div className="flex gap-2">
					<Button type="submit">Onboard user</Button>
					<Button type="button" variant="outline" onClick={reset}>
						Reset
					</Button>
				</div>
			</form>
			<ResultDisplay result={result} status={status} />
		</ExampleCard>
	);
}
