import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { baseLayoutOptions } from "@/lib/shared-layout";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<DocsLayout tree={source.getPageTree()} {...baseLayoutOptions}>
			{children}
		</DocsLayout>
	);
}
