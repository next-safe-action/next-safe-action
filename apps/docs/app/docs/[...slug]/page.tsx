import { DocsPage, DocsBody, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { notFound } from "next/navigation";
import { MarkdownCopyButton, ViewOptions } from "@/components/ai/page-actions";
import { getPageImage, source } from "@/lib/source";
import { useMDXComponents } from "@/mdx-components";

export default async function Page(props: { params: Promise<{ slug: string[] }> }) {
	const params = await props.params;
	const page = source.getPage(params.slug);
	if (!page) notFound();

	const MDXContent = page.data.body;
	const markdownUrl = `${page.url}.md`;
	const githubUrl = `https://github.com/next-safe-action/next-safe-action/blob/main/apps/docs/content/docs/${page.path}`;

	return (
		<DocsPage toc={page.data.toc} breadcrumb={{ enabled: true }} footer={{ enabled: true }}>
			<div className="flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<DocsTitle>{page.data.title}</DocsTitle>
				<div className="flex shrink-0 flex-row items-center gap-2">
					<MarkdownCopyButton markdownUrl={markdownUrl} />
					<ViewOptions markdownUrl={markdownUrl} githubUrl={githubUrl} />
				</div>
			</div>
			<DocsBody>
				<MDXContent components={useMDXComponents({})} />
			</DocsBody>
		</DocsPage>
	);
}

export function generateStaticParams() {
	return source.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug: string[] }> }) {
	const params = await props.params;
	const page = source.getPage(params.slug);
	if (!page) notFound();

	return {
		title: page.data.title,
		description: page.data.description,
		openGraph: {
			images: getPageImage(page).url,
		},
	};
}
