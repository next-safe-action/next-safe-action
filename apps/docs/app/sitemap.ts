import type { MetadataRoute } from "next";
import { source } from "@/lib/source";

const url = "https://next-safe-action.dev";

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{
			url,
			lastModified: new Date(),
			priority: 1,
		},
		...source.getPages().map((page) => ({
			url: `${url}${page.url}`,
			lastModified: new Date(),
			priority: 0.8,
		})),
	];
}
