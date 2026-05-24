import { describe, expect, test } from "vitest";
import { deepmerge } from "../deep-merge";

describe("deepmerge - records", () => {
	test("merges nested records recursively, later value wins on conflict", () => {
		const result = deepmerge({ config: { timeout: 5000, retries: 3 } }, { config: { timeout: 10000 } });

		// `retries` from the first object survives, `timeout` from the second wins.
		expect(result).toStrictEqual({ config: { timeout: 10000, retries: 3 } });
	});

	test("preserves keys present in only one object", () => {
		const result = deepmerge({ a: 1, only: "left" }, { a: 2, extra: "right" });

		expect(result).toStrictEqual({ a: 2, only: "left", extra: "right" });
	});

	test("merges deeply nested objects across three levels", () => {
		const result = deepmerge(
			{ level1: { level2: { level3: { keep: 1, override: "old" } } } },
			{ level1: { level2: { level3: { override: "new", added: 2 } } } }
		);

		expect(result).toStrictEqual({
			level1: { level2: { level3: { keep: 1, override: "new", added: 2 } } },
		});
	});

	test("does not mutate the input objects and returns fresh nested objects", () => {
		const a = { nested: { x: 1 } };
		const b = { nested: { y: 2 } };

		const result = deepmerge(a, b);

		expect(result).toStrictEqual({ nested: { x: 1, y: 2 } });
		expect(a).toStrictEqual({ nested: { x: 1 } });
		expect(b).toStrictEqual({ nested: { y: 2 } });
		expect(result).not.toBe(a);
		expect((result as { nested: object }).nested).not.toBe(a.nested);
	});
});

describe("deepmerge - primitives and mismatched types", () => {
	test("primitive values: the last one wins", () => {
		expect(deepmerge({ x: 1 }, { x: 2 })).toStrictEqual({ x: 2 });
		expect(deepmerge({ x: "a" }, { x: "b" })).toStrictEqual({ x: "b" });
		expect(deepmerge({ x: true }, { x: false })).toStrictEqual({ x: false });
	});

	test("record vs array: the last one wins (no merge)", () => {
		expect(deepmerge({ x: { a: 1 } }, { x: [1, 2] })).toStrictEqual({ x: [1, 2] });
	});

	test("primitive vs record: the last one wins", () => {
		expect(deepmerge({ x: 5 }, { x: { a: 1 } })).toStrictEqual({ x: { a: 1 } });
	});

	test("array vs record: the last one wins", () => {
		expect(deepmerge({ x: [1] }, { x: { a: 1 } })).toStrictEqual({ x: { a: 1 } });
	});

	test("null and undefined values: the last one wins", () => {
		expect(deepmerge({ x: { a: 1 } }, { x: null })).toStrictEqual({ x: null });
		expect(deepmerge({ x: 1 }, { x: undefined })).toStrictEqual({ x: undefined });
	});
});

describe("deepmerge - arrays", () => {
	test("concatenates arrays nested in records", () => {
		expect(deepmerge({ tags: ["a", "b"] }, { tags: ["c"] })).toStrictEqual({ tags: ["a", "b", "c"] });
	});

	test("concatenates top-level arrays", () => {
		expect(deepmerge([1, 2], [3, 4])).toStrictEqual([1, 2, 3, 4]);
	});
});

describe("deepmerge - Sets and Maps", () => {
	test("unions Sets", () => {
		expect(deepmerge({ s: new Set([1, 2]) }, { s: new Set([2, 3]) })).toStrictEqual({
			s: new Set([1, 2, 3]),
		});
	});

	test("combines Maps, later entry wins on key conflict", () => {
		const result = deepmerge(
			{ m: new Map([["a", 1]]) },
			{
				m: new Map([
					["a", 2],
					["b", 3],
				]),
			}
		);

		expect(result).toStrictEqual({
			m: new Map([
				["a", 2],
				["b", 3],
			]),
		});
	});
});

describe("deepmerge - keys", () => {
	test("preserves symbol keys, later value winning", () => {
		const sym = Symbol("token");
		const result = deepmerge({ [sym]: 1, keep: "a" }, { [sym]: 2 }) as Record<PropertyKey, unknown>;

		expect(result[sym]).toBe(2);
		expect(result.keep).toBe("a");
	});

	test("does not pollute Object.prototype via a malicious __proto__ key", () => {
		const malicious = JSON.parse('{ "__proto__": { "polluted": true } }');

		const result = deepmerge({ safe: 1 }, malicious) as Record<string, unknown>;

		// The prototype chain must be untouched.
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
		expect(Object.prototype.hasOwnProperty.call(Object.prototype, "polluted")).toBe(false);
		expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
		// The non-malicious key is still merged normally.
		expect(result.safe).toBe(1);
	});
});

describe("deepmerge - arity", () => {
	test("returns the single object when called with one argument", () => {
		expect(deepmerge({ a: 1 })).toStrictEqual({ a: 1 });
	});

	test("returns an empty object when called with no arguments", () => {
		expect(deepmerge()).toStrictEqual({});
	});

	test("folds over more than two objects, last value winning", () => {
		expect(deepmerge({ a: 1 }, { b: 2 }, { a: 3, c: 4 })).toStrictEqual({ a: 3, b: 2, c: 4 });
	});
});
