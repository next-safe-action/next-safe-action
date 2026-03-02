import { DocsPage, DocsBody, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { source } from "@/lib/source";
import { notFound } from "next/navigation";

export default async function Page(props: { params: Promise<{ slug: string[] }> }) {
	const params = await props.params;
	const page = source.getPage(params.slug);
	if (!page) notFound();

	const MDXContent = page.data.body;

	return (
		<DocsPage toc={page.data.toc} breadcrumb={{ enabled: true }} footer={{ enabled: true }}>
			<DocsTitle>{page.data.title}</DocsTitle>
			<DocsBody>
				<MDXContent components={defaultMdxComponents} />
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
	};
}
