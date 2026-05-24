/*!
 * This file is a deep-merge implementation adapted from `deepmerge-ts`
 * (https://github.com/RebeccaStevens/deepmerge-ts). Portions of the code below, in
 * particular the plain-record detection (`isRecord`), key collection (`getKeys`) and the
 * recursive record merge with its `__proto__` prototype-pollution guard, are derived from
 * that project and remain under its original license, reproduced in full below.
 *
 * BSD 3-Clause License
 *
 * Copyright (c) 2021, Rebecca Stevens
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its
 *    contributors may be used to endorse or promote products derived from
 *    this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * Internal deep-merge utility.
 *
 * Inlined from, and trimmed down to only what this library needs of, `deepmerge-ts`, so
 * that next-safe-action ships with zero runtime dependencies and is not exposed to
 * supply-chain attacks targeting third-party packages.
 *
 * The library only ever calls `deepmerge(a, b)` with two plain middleware context objects,
 * so this reproduces deepmerge-ts's *default* merge behavior for that case:
 * - plain records (objects) are merged recursively;
 * - arrays are concatenated;
 * - Sets are unioned and Maps are combined (later entries win on key conflict);
 * - any other or mismatched values: the last (rightmost) value wins.
 */

// `Object.prototype.toString` tags that mark a value as a plain record.
const validRecordToStringValues = ["[object Object]", "[object Module]"];

/**
 * Whether the given value is a plain record, as opposed to an array, Set, Map, class
 * instance, or other exotic object. Mirrors deepmerge-ts's record detection.
 */
function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	if (!validRecordToStringValues.includes(Object.prototype.toString.call(value))) {
		return false;
	}

	const { constructor } = value as { constructor?: { prototype?: unknown } };

	// Objects with a null prototype (e.g. `Object.create(null)`) have no constructor.
	if (constructor === undefined) {
		return true;
	}

	const prototype = constructor.prototype;

	if (
		prototype === null ||
		typeof prototype !== "object" ||
		!validRecordToStringValues.includes(Object.prototype.toString.call(prototype))
	) {
		return false;
	}

	// A genuine plain object's prototype owns the standard Object.prototype methods.
	if (!Object.hasOwn(prototype, "isPrototypeOf")) {
		return false;
	}

	return true;
}

/**
 * The union of both objects' own enumerable string keys and own symbol keys, in
 * first-then-second insertion order.
 */
function getKeys(a: object, b: object): Set<PropertyKey> {
	const keys = new Set<PropertyKey>();

	for (const object of [a, b]) {
		for (const key of [...Object.keys(object), ...Object.getOwnPropertySymbols(object)]) {
			keys.add(key);
		}
	}

	return keys;
}

/**
 * Whether `object` has `property` as an own enumerable property.
 */
function objectHasProperty(object: object, property: PropertyKey): boolean {
	return Object.prototype.propertyIsEnumerable.call(object, property);
}

/**
 * Merge two values according to the default strategy described at the top of this file.
 */
function mergeValues(a: unknown, b: unknown): unknown {
	if (isRecord(a) && isRecord(b)) {
		return mergeRecords(a, b);
	}

	if (Array.isArray(a) && Array.isArray(b)) {
		return [...a, ...b];
	}

	if (a instanceof Set && b instanceof Set) {
		return new Set([...a, ...b]);
	}

	if (a instanceof Map && b instanceof Map) {
		return new Map([...a, ...b]);
	}

	// Mismatched types, primitives, or any other value: the last one wins.
	return b;
}

/**
 * Recursively merge two plain records into a fresh object.
 */
function mergeRecords(a: Record<PropertyKey, unknown>, b: Record<PropertyKey, unknown>): Record<PropertyKey, unknown> {
	const result: Record<PropertyKey, unknown> = {};

	for (const key of getKeys(a, b)) {
		const inA = objectHasProperty(a, key);
		const inB = objectHasProperty(b, key);

		// The key is non-enumerable on both objects: nothing to merge.
		if (!inA && !inB) {
			continue;
		}

		let value: unknown;
		if (inA && inB) {
			value = mergeValues(a[key], b[key]);
		} else if (inB) {
			value = b[key];
		} else {
			value = a[key];
		}

		// Assigning to `__proto__` via `result[key] = value` would mutate the prototype
		// instead of creating an own property, so guard against prototype pollution.
		if (key === "__proto__") {
			Object.defineProperty(result, key, {
				value,
				configurable: true,
				enumerable: true,
				writable: true,
			});
		} else {
			result[key] = value;
		}
	}

	return result;
}

/**
 * Deeply merge the given objects, with the last value winning on conflict. The library
 * always calls this with exactly two middleware context objects.
 */
export function deepmerge(...objects: ReadonlyArray<object>): object {
	let result: unknown = objects[0] ?? {};

	for (let index = 1; index < objects.length; index++) {
		result = mergeValues(result, objects[index]);
	}

	return result as object;
}
