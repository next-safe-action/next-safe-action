/** @type {import('next').NextConfig} */
const nextConfig = {
	cacheComponents: true,
	experimental: {
		authInterrupts: true,
		turbopackFileSystemCacheForDev: true,
	},
};

module.exports = nextConfig;
