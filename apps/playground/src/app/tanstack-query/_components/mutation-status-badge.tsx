"use client";

import { Badge } from "@/components/ui/badge";

type MutationStatus = "idle" | "pending" | "success" | "error";

const statusConfig: Record<
	MutationStatus,
	{ label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
	idle: { label: "Idle", variant: "secondary" },
	pending: { label: "Pending", variant: "default" },
	success: { label: "Success", variant: "default" },
	error: { label: "Error", variant: "destructive" },
};

type Props = {
	status: MutationStatus;
};

export function MutationStatusBadge({ status }: Props) {
	const config = statusConfig[status] ?? { label: status, variant: "outline" as const };
	return <Badge variant={config.variant}>{config.label}</Badge>;
}
