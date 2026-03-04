"use client";

import type { HookActionStatus } from "next-safe-action/hooks";
import { StatusBadge } from "@/components/status-badge";

type Props = {
	result?: unknown;
	status?: HookActionStatus;
	label?: string;
};

export function ResultDisplay({ result, status, label }: Props) {
	return (
		<div className="mt-4 space-y-2">
			{status ? (
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium">Status:</span>
					<StatusBadge status={status} />
				</div>
			) : null}
			<div>
				<span className="text-sm font-medium">{label ?? "Result:"}</span>
				<pre className="bg-muted mt-1 max-h-64 overflow-auto rounded-md border p-3 font-mono text-sm">
					{result !== undefined ? JSON.stringify(result, null, 2) : "—"}
				</pre>
			</div>
		</div>
	);
}
