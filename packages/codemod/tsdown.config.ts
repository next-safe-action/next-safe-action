import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/cli.ts"],
	format: ["esm"],
	target: "node18",
	platform: "node",
	clean: true,
	dts: false,
});
