import { test } from "vitest";
import { z } from "zod";
import { createSafeActionClient } from "../..";

test("action compiles without metadata schema", () => {
	const ac = createSafeActionClient();

	// No metadata schema → HasMetadata defaults to true → .action() is available
	ac.action(async () => {
		return {};
	});
});

test("action compiles with metadata schema and metadata provided", () => {
	const ac = createSafeActionClient({
		defineMetadataSchema: () => z.object({ actionName: z.string() }),
	});

	// Metadata schema defined AND metadata provided → .action() compiles
	ac.metadata({ actionName: "test" }).action(async () => {
		return {};
	});
});

test("action errors without metadata when metadata schema is defined", () => {
	const ac = createSafeActionClient({
		defineMetadataSchema: () => z.object({ actionName: z.string() }),
	});

	// @ts-expect-error - calling .action() without .metadata() when metadata schema is defined
	ac.action(async () => {
		return {};
	});
});

test("stateAction compiles without metadata schema", () => {
	const ac = createSafeActionClient();

	ac.stateAction(async () => {
		return {};
	});
});

test("stateAction compiles with metadata schema and metadata provided", () => {
	const ac = createSafeActionClient({
		defineMetadataSchema: () => z.object({ actionName: z.string() }),
	});

	ac.metadata({ actionName: "test" }).stateAction(async () => {
		return {};
	});
});

test("stateAction errors without metadata when metadata schema is defined", () => {
	const ac = createSafeActionClient({
		defineMetadataSchema: () => z.object({ actionName: z.string() }),
	});

	// @ts-expect-error - calling .stateAction() without .metadata() when metadata schema is defined
	ac.stateAction(async () => {
		return {};
	});
});

test("metadata method accepts correct type", () => {
	const ac = createSafeActionClient({
		defineMetadataSchema: () => z.object({ actionName: z.string(), role: z.enum(["admin", "user"]) }),
	});

	// Valid metadata
	ac.metadata({ actionName: "test", role: "admin" });

	// @ts-expect-error - invalid metadata type (wrong role value)
	ac.metadata({ actionName: "test", role: "superadmin" });
});
