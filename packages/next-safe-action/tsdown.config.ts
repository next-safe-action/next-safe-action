import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		"index": "src/index.ts",
		"hooks": "src/hooks.ts",
		"routes": "src/routes/index.ts",
		"routes/openapi": "src/routes/openapi.ts",
	},
	format: ["esm"],
	clean: true,
	sourcemap: true,
	dts: true,
});
