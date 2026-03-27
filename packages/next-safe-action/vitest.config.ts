import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/__tests__/**/*.test.ts", "src/__tests__/**/*.test.tsx"],
		environment: "jsdom",
		setupFiles: ["src/__tests__/setup.ts"],
		typecheck: {
			enabled: true,
			include: ["src/__tests__/**/*.test-d.ts"],
			tsconfig: "./tsconfig.json",
		},
	},
});
