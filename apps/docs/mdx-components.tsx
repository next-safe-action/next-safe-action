import defaultMdxComponents from "fumadocs-ui/mdx";

export function useMDXComponents(components: Record<string, any>): Record<string, any> {
	return {
		...defaultMdxComponents,
		...components,
	};
}
