import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { addSidebarBadge } from "@/lib/page-tree-utils";
import { baseLayoutOptions } from "@/lib/shared-layout";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
	let tree = addSidebarBadge(source.getPageTree(), "/docs/ai-skills", "NEW");
	tree = addSidebarBadge(tree, "/docs/integrations/tanstack-query", "NEW");

	return (
		<DocsLayout tree={tree} {...baseLayoutOptions}>
			{children}
		</DocsLayout>
	);
}
