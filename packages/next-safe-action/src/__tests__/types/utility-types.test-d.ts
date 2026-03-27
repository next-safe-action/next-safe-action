import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import { createSafeActionClient } from "../..";
import type {
	InferCtx,
	InferMetadata,
	InferServerError,
	InferMiddlewareFnNextCtx,
	MiddlewareFn,
	SafeActionFn,
	SafeStateActionFn,
} from "../../index.types";
import type { Prettify } from "../../utils.types";

test("InferServerError from SafeActionClient", () => {
	const ac = createSafeActionClient({
		handleServerError: () => ({ code: "ERR", message: "fail" }),
	});

	type SE = InferServerError<typeof ac>;
	expectTypeOf<SE>().toEqualTypeOf<{ code: string; message: string }>();
	expectTypeOf<SE>().not.toBeAny();
});

test("InferServerError from SafeActionFn", () => {
	type CustomError = { code: number };
	type ActionFn = SafeActionFn<CustomError, undefined, [], undefined, void>;
	type SE = InferServerError<ActionFn>;
	expectTypeOf<SE>().toEqualTypeOf<CustomError>();
});

test("InferServerError from SafeStateActionFn", () => {
	type CustomError = { code: number };
	type StateActionFn = SafeStateActionFn<CustomError, undefined, [], undefined, void>;
	type SE = InferServerError<StateActionFn>;
	expectTypeOf<SE>().toEqualTypeOf<CustomError>();
});

test("InferServerError defaults to string", () => {
	const ac = createSafeActionClient();
	type SE = InferServerError<typeof ac>;
	expectTypeOf<SE>().toEqualTypeOf<string>();
});

test("InferMiddlewareFnNextCtx extracts next context type", () => {
	type MwFn = MiddlewareFn<string, undefined, {}, { userId: string }>;
	type NextCtx = InferMiddlewareFnNextCtx<MwFn>;
	expectTypeOf<NextCtx>().toEqualTypeOf<{ userId: string }>();
});

test("InferMiddlewareFnNextCtx returns never for non-middleware", () => {
	type NotMw = string;
	type Result = InferMiddlewareFnNextCtx<NotMw>;
	expectTypeOf<Result>().toEqualTypeOf<never>();
});

test("Prettify expands intersection types", () => {
	type Intersection = { a: string } & { b: number };
	type Expanded = Prettify<Intersection>;

	expectTypeOf<Expanded>().toEqualTypeOf<{ a: string; b: number }>();
});

test("InferServerError returns never for non-matching types", () => {
	type Result = InferServerError<string>;
	expectTypeOf<Result>().toEqualTypeOf<never>();
});

test("InferCtx returns never for non-matching types", () => {
	type Result = InferCtx<string>;
	expectTypeOf<Result>().toEqualTypeOf<never>();
});

test("InferMetadata returns never for non-matching types", () => {
	type Result = InferMetadata<string>;
	expectTypeOf<Result>().toEqualTypeOf<never>();
});

test("InferServerError from MiddlewareFn", () => {
	type MwFn = MiddlewareFn<{ code: string }, { actionName: string }, { userId: string }, {}>;
	type SE = InferServerError<MwFn>;
	expectTypeOf<SE>().toEqualTypeOf<{ code: string }>();
});

// ─── InferCtx positive tests ─────────────────────────────────────────

test("InferCtx from MiddlewareFn extracts context type", () => {
	type MwFn = MiddlewareFn<string, undefined, { userId: string; role: string }, {}>;
	type Ctx = InferCtx<MwFn>;
	expectTypeOf<Ctx>().toEqualTypeOf<{ userId: string; role: string }>();
	expectTypeOf<Ctx>().not.toBeAny();
});

test("InferCtx from SafeActionClient with middleware (HasMetadata=false)", () => {
	// InferCtx requires HasMetadata=false, which means metadata schema is defined but .metadata() not called yet
	const ac = createSafeActionClient({
		defineMetadataSchema: () => z.object({ actionName: z.string() }),
	}).use(async ({ next }) => {
		return next({ ctx: { userId: "123" } });
	});

	type Ctx = InferCtx<typeof ac>;
	expectTypeOf<Ctx>().toEqualTypeOf<{ userId: string }>();
	expectTypeOf<Ctx>().not.toBeAny();
});

// ─── InferMetadata positive tests ────────────────────────────────────

test("InferMetadata from MiddlewareFn extracts metadata type", () => {
	type MwFn = MiddlewareFn<string, { actionName: string; role: string }, {}, {}>;
	type Meta = InferMetadata<MwFn>;
	expectTypeOf<Meta>().toEqualTypeOf<{ actionName: string; role: string }>();
	expectTypeOf<Meta>().not.toBeAny();
});

test("InferMetadata from SafeActionClient with metadata schema (HasMetadata=false)", () => {
	const ac = createSafeActionClient({
		defineMetadataSchema: () => z.object({ actionName: z.string() }),
	});

	type Meta = InferMetadata<typeof ac>;
	expectTypeOf<Meta>().toEqualTypeOf<{ actionName: string }>();
	expectTypeOf<Meta>().not.toBeAny();
});
