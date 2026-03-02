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
				destination: "/docs/getting-started",
				permanent: true,
			},
		];
	},
};

export default withMDX(config);
