import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts", "src/openapi.ts"],
	format: ["esm"],
	clean: true,
	sourcemap: true,
	dts: true,
	deps: {
		resolveDepSubpath: false,
	},
});
