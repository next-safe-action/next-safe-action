import type { HookActionStatus } from "next-safe-action/hooks";
import { Badge } from "@/components/ui/badge";

const statusConfig: Record<
	HookActionStatus,
	{ label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
	idle: { label: "Idle", variant: "secondary" },
	executing: { label: "Executing", variant: "default" },
	hasSucceeded: { label: "Succeeded", variant: "default" },
	hasErrored: { label: "Errored", variant: "destructive" },
	hasNavigated: { label: "Navigated", variant: "outline" },
};

type Props = {
	status: HookActionStatus;
};

export function StatusBadge({ status }: Props) {
	const config = statusConfig[status] ?? { label: status, variant: "outline" as const };

	return <Badge variant={config.variant}>{config.label}</Badge>;
}
