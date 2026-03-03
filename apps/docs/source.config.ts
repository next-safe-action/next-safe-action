import { remarkNpm, rehypeCodeDefaultOptions } from "fumadocs-core/mdx-plugins";
import { defineDocs, defineConfig } from "fumadocs-mdx/config";
import { transformerTwoslash } from "fumadocs-twoslash";

export const docs = defineDocs({
	dir: "content/docs",
});

export default defineConfig({
	mdxOptions: {
		remarkPlugins: [remarkNpm],
		rehypeCodeOptions: {
			themes: {
				light: "github-light",
				dark: "github-dark",
			},
			transformers: [...(rehypeCodeDefaultOptions.transformers ?? []), transformerTwoslash()],
			langs: ["js", "jsx", "ts", "tsx"],
		},
	},
});
