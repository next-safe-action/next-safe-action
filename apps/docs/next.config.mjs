import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
	images: {
		remotePatterns: [{ hostname: "avatars.githubusercontent.com" }],
	},
	async redirects() {
		return [
			{
				source: "/docs",
				destination: "/docs/introduction",
				permanent: true,
			},
			{
				source: "/docs/getting-started",
				destination: "/docs/quick-start",
				permanent: true,
			},
			{
				source: "/docs/define-actions/create-the-client",
				destination: "/docs/concepts/action-client",
				permanent: true,
			},
			{
				source: "/docs/define-actions/instance-methods",
				destination: "/docs/api/safe-action-client",
				permanent: true,
			},
			{
				source: "/docs/define-actions/middleware",
				destination: "/docs/guides/middleware",
				permanent: true,
			},
			{
				source: "/docs/define-actions/bind-arguments",
				destination: "/docs/advanced/bind-arguments",
				permanent: true,
			},
			{
				source: "/docs/define-actions/validation-errors",
				destination: "/docs/advanced/custom-validation-errors",
				permanent: true,
			},
			{
				source: "/docs/define-actions/extend-previous-schemas",
				destination: "/docs/advanced/extend-schemas",
				permanent: true,
			},
			{
				source: "/docs/define-actions/action-utils",
				destination: "/docs/api/safe-action-client",
				permanent: true,
			},
			{
				source: "/docs/define-actions/action-result-object",
				destination: "/docs/concepts/action-result",
				permanent: true,
			},
			{
				source: "/docs/execute-actions/direct-execution",
				destination: "/docs/guides/executing-actions",
				permanent: true,
			},
			{
				source: "/docs/execute-actions/hooks/useaction",
				destination: "/docs/guides/hooks",
				permanent: true,
			},
			{
				source: "/docs/execute-actions/hooks/useoptimisticaction",
				destination: "/docs/guides/optimistic-updates",
				permanent: true,
			},
			{
				source: "/docs/execute-actions/hooks/usestateaction",
				destination: "/docs/guides/hooks",
				permanent: true,
			},
			{
				source: "/docs/execute-actions/hooks/hook-callbacks",
				destination: "/docs/guides/hooks",
				permanent: true,
			},
			{
				source: "/docs/recipes/form-actions",
				destination: "/docs/guides/form-actions",
				permanent: true,
			},
			{
				source: "/docs/recipes/upload-files",
				destination: "/docs/advanced/file-uploads",
				permanent: true,
			},
			{
				source: "/docs/recipes/i18n",
				destination: "/docs/advanced/i18n",
				permanent: true,
			},
			{
				source: "/docs/recipes/playground",
				destination: "/docs/playground",
				permanent: true,
			},
			{
				source: "/docs/types/infer-types",
				destination: "/docs/api/type-utilities",
				permanent: true,
			},
		];
	},
};

export default withMDX(config);
