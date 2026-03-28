"use client";

import { hasServerError, hasValidationErrors, mutationOptions } from "@next-safe-action/adapter-tanstack-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExampleCard } from "@/components/example-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SourceCode } from "@/lib/shiki";
import { createUser } from "../_actions/create-user-action";
import { MutationStatusBadge } from "./mutation-status-badge";

type Props = {
	source?: SourceCode;
};

export function MutationWithCallbacksDemo({ source }: Props) {
	const queryClient = useQueryClient();

	const mutation = useMutation(
		mutationOptions(createUser, {
			onSuccess: (data) => {
				toast.success(`User "${data.name}" created successfully!`);
				void queryClient.invalidateQueries({ queryKey: ["users"] });
			},
			onError: (error) => {
				if (hasValidationErrors(error)) {
					toast.error("Please fix the validation errors.");
				} else if (hasServerError(error)) {
					toast.error(`Server error: ${error.serverError}`);
				}
			},
			retry: (count, error) => {
				if (hasValidationErrors(error)) return false;
				return count < 2;
			},
		})
	);

	return (
		<ExampleCard
			title="Mutation with callbacks"
			description="onSuccess shows a toast + invalidates queries, onError uses type guards, retry skips validation errors."
			source={source}
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					const formData = new FormData(e.currentTarget);
					mutation.mutate({
						name: formData.get("name") as string,
						email: formData.get("email") as string,
					});
				}}
				className="space-y-4"
			>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="cb-name">Name</Label>
						<Input id="cb-name" name="name" placeholder="Jane Doe" />
					</div>
					<div className="space-y-2">
						<Label htmlFor="cb-email">Email</Label>
						<Input id="cb-email" name="email" placeholder='Try "taken@example.com"' />
					</div>
				</div>
				<div className="flex gap-2">
					<Button type="submit" disabled={mutation.isPending}>
						{mutation.isPending ? "Creating..." : "Create user"}
					</Button>
					<Button type="button" variant="outline" onClick={() => mutation.reset()}>
						Reset
					</Button>
				</div>
			</form>

			<div className="mt-3 flex items-center gap-2">
				<span className="text-sm font-medium">Status:</span>
				<MutationStatusBadge status={mutation.status} />
			</div>

			{mutation.isError ? (
				<div className="mt-3 space-y-2">
					<div className="flex items-center gap-2">
						<span className="text-destructive text-sm font-medium">Error kind:</span>
						<code className="bg-muted rounded px-1.5 py-0.5 text-xs">{mutation.error.kind}</code>
					</div>
					{hasServerError(mutation.error) ? (
						<div>
							<span className="text-sm font-medium">Server error:</span>
							<pre className="bg-muted mt-1 max-h-40 overflow-auto rounded-md border p-3 font-mono text-sm">
								{JSON.stringify(mutation.error.serverError, null, 2)}
							</pre>
						</div>
					) : null}
					{hasValidationErrors(mutation.error) ? (
						<div>
							<span className="text-sm font-medium">Validation errors:</span>
							<pre className="bg-muted mt-1 max-h-40 overflow-auto rounded-md border p-3 font-mono text-sm">
								{JSON.stringify(mutation.error.validationErrors, null, 2)}
							</pre>
						</div>
					) : null}
				</div>
			) : null}

			<div className="mt-4">
				<span className="text-sm font-medium">Result:</span>
				<pre className="bg-muted mt-1 max-h-64 overflow-auto rounded-md border p-3 font-mono text-sm">
					{mutation.data !== undefined ? JSON.stringify(mutation.data, null, 2) : "—"}
				</pre>
			</div>
		</ExampleCard>
	);
}
