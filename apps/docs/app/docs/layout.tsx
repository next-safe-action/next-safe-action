import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { baseLayoutOptions } from "@/lib/shared-layout";
import { source } from "@/lib/source";
import { addSidebarBadge } from "@/lib/page-tree-utils";

export default function Layout({ children }: { children: ReactNode }) {
	const tree = addSidebarBadge(source.getPageTree(), "/docs/ai-skills", "NEW");

	return (
		<DocsLayout tree={tree} {...baseLayoutOptions}>
			{children}
		</DocsLayout>
	);
}
