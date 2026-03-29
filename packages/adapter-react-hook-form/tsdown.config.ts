import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts", "src/hooks.ts"],
	format: ["esm"],
	clean: true,
	sourcemap: true,
	dts: true,
});
