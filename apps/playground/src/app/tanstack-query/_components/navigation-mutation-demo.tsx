"use client";

import { mutationOptions } from "@next-safe-action/adapter-tanstack-query";
import { useMutation } from "@tanstack/react-query";
import { ExampleCard } from "@/components/example-card";
import { Button } from "@/components/ui/button";
import type { SourceCode } from "@/lib/shiki";
import { testNavigateMutation } from "../_actions/navigation-action";
import { MutationStatusBadge } from "./mutation-status-badge";

type Props = {
	source?: SourceCode;
};

export function NavigationMutationDemo({ source }: Props) {
	const mutation = useMutation(mutationOptions(testNavigateMutation));

	return (
		<ExampleCard
			title="Navigation errors"
			description="Navigation functions (redirect, notFound, forbidden, unauthorized) work automatically with mutationOptions()."
			source={source}
		>
			<div className="flex flex-wrap gap-2">
				<Button onClick={() => mutation.mutate({ kind: "redirect" })} disabled={mutation.isPending}>
					Redirect
				</Button>
				<Button
					onClick={() => mutation.mutate({ kind: "notFound" })}
					variant="secondary"
					disabled={mutation.isPending}
				>
					Not Found
				</Button>
				<Button
					onClick={() => mutation.mutate({ kind: "forbidden" })}
					variant="secondary"
					disabled={mutation.isPending}
				>
					Forbidden
				</Button>
				<Button
					onClick={() => mutation.mutate({ kind: "unauthorized" })}
					variant="secondary"
					disabled={mutation.isPending}
				>
					Unauthorized
				</Button>
				<Button
					onClick={() => mutation.mutate({ kind: "happy-path" })}
					variant="outline"
					disabled={mutation.isPending}
				>
					Happy path
				</Button>
				<Button variant="ghost" onClick={() => mutation.reset()}>
					Reset
				</Button>
			</div>

			<div className="mt-3 flex items-center gap-2">
				<span className="text-sm font-medium">Status:</span>
				<MutationStatusBadge status={mutation.status} />
			</div>

			<div className="mt-4">
				<span className="text-sm font-medium">Result:</span>
				<pre className="bg-muted mt-1 max-h-64 overflow-auto rounded-md border p-3 font-mono text-sm">
					{mutation.data !== undefined ? JSON.stringify(mutation.data, null, 2) : "-"}
				</pre>
			</div>

			<p className="text-muted-foreground mt-4 text-xs">
				Note: The adapter&apos;s <code className="bg-muted rounded px-1 py-0.5 text-xs">mutationOptions()</code>{" "}
				automatically composes <code className="bg-muted rounded px-1 py-0.5 text-xs">throwOnError</code> to re-throw
				navigation errors during React&apos;s render phase and{" "}
				<code className="bg-muted rounded px-1 py-0.5 text-xs">retry</code> to skip them. No additional configuration is
				required.
			</p>
		</ExampleCard>
	);
}
