/* oxlint-disable typescript/no-unsafe-member-access, typescript/no-unsafe-assignment */
import type { StandardSchemaV1 } from "./standard-schema";
import type { FlattenedValidationErrors, IssueWithUnionErrors, ValidationErrors } from "./validation-errors.types";

const getKey = (segment: PropertyKey | StandardSchemaV1.PathSegment) =>
	typeof segment === "object" ? segment.key : segment;

const getIssueMessage = (issue: IssueWithUnionErrors): string[] => {
	if (issue.unionErrors) {
		return issue.unionErrors.flatMap((u) => u.issues.map((i) => i.message));
	}
	return [issue.message];
};

// Assigns `value` as a plain own, enumerable, writable property of `obj` without ever triggering an
// inherited setter. In particular this neutralizes the `__proto__` accessor: a plain `obj.__proto__ = x`
// would reassign the object's prototype, whereas this stores a regular own `"__proto__"` data property.
// Combined with `Object.hasOwn` lookups (instead of truthy `obj[key]` checks, which follow inherited
// members like `constructor`/`prototype`), it makes building errors objects from untrusted key paths
// safe against prototype pollution. Validation issue paths can contain client-controlled segments (e.g.
// a `z.record` whose keys come from user input), so those keys must never reach `Object.prototype`.
const setOwnProperty = (obj: Record<PropertyKey, unknown>, key: PropertyKey, value: unknown) => {
	Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
};

// This function is used internally to build the validation errors object from a list of validation issues.
export const buildValidationErrors = <Schema extends StandardSchemaV1 | undefined>(
	issues: readonly IssueWithUnionErrors[]
) => {
	// Using `any` because validation errors are dynamically-shaped nested objects
	// built from schema paths with PropertyKey keys (string | number | symbol).
	const ve: any = {};

	for (const issue of issues) {
		const { path } = issue;

		// When path is undefined or empty, set root errors.
		if (!path || path.length === 0) {
			const issueMessages = getIssueMessage(issue);
			ve._errors = ve._errors ? [...ve._errors, ...issueMessages] : [...issueMessages];
			continue;
		}

		// Reference to errors object.
		let ref = ve;

		// Set object for the path, if it doesn't exist. We use `Object.hasOwn` (not `!ref[k]`) so that
		// inherited members like `constructor`/`prototype` are never followed, and `setOwnProperty` so that
		// a `__proto__` segment cannot reassign the prototype. See the helper's comment and #452.
		for (let i = 0; i < path.length - 1; i++) {
			const k = getKey(path[i]!);

			if (!Object.hasOwn(ref, k)) {
				setOwnProperty(ref, k, {});
			}

			ref = ref[k];
		}

		// Key is always the last element of the path.
		const key = getKey(path[path.length - 1]!);

		const issueMessage = getIssueMessage(issue);

		// Set error for the current path. If `_errors` array exists, add the message to it.
		const existing = Object.hasOwn(ref, key) ? structuredClone(ref[key]) : {};
		setOwnProperty(
			ref,
			key,
			existing._errors
				? { ...existing, _errors: [...existing._errors, ...issueMessage] }
				: { ...existing, _errors: [...issueMessage] }
		);
	}

	return ve as ValidationErrors<Schema>;
};

// Marker prefixing the `digest` of an `ActionServerValidationError`. When the error is thrown inside
// a Next.js `'use cache'` scope (`cacheComponents` enabled), the RSC/Flight boundary serializes it and
// the action engine receives a plain `Error` that lost its prototype and the `validationErrors`
// property: only `message` and `digest` survive (and the message is redacted in production). Encoding
// the payload in the `digest` (the one channel Next.js preserves verbatim, see `create-error-handler`)
// lets the engine still recognize it as a validation error. This mirrors how Next.js's own framework
// errors (redirect, notFound) are detected by their `digest` after crossing the boundary. See #452.
const SERVER_VALIDATION_ERROR_DIGEST = "NEXT_SAFE_ACTION_SERVER_VALIDATION_ERROR";

// This class is internally used to throw validation errors in action's server code function, using
// `returnValidationErrors`.
export class ActionServerValidationError<Schema extends StandardSchemaV1> extends Error {
	public validationErrors: ValidationErrors<Schema>;
	public digest: string;
	constructor(validationErrors: ValidationErrors<Schema>) {
		super("Server Action server validation error(s) occurred");
		this.validationErrors = validationErrors;

		// The payload is encoded onto the `digest` so it can survive the `'use cache'` RSC boundary, which
		// means it must be JSON-serializable. Fail loudly with a clear message instead of letting a raw
		// `TypeError: Converting circular structure to JSON` leak from the constructor.
		let encoded: string;
		try {
			encoded = JSON.stringify(validationErrors);
		} catch {
			throw new TypeError(
				"The validation errors object passed to `returnValidationErrors` must be JSON-serializable (no circular references, BigInts, functions, etc.)."
			);
		}

		this.digest = `${SERVER_VALIDATION_ERROR_DIGEST};${encoded}`;
	}
}

// Recovers the validation errors payload from an error thrown via `returnValidationErrors`. We always
// read it back out of the `digest`, never from the `instanceof`/`validationErrors` instance property:
// the constructor encodes the payload into the `digest` unconditionally, so the same channel is present
// both for the in-memory instance (no `'use cache'`) and for the degraded plain `Error` that survives
// the RSC/Flight boundary (only `message` + `digest` make it across). Reading this single channel makes
// the behavior identical with and without `cacheComponents` by construction. Returns `undefined` for any
// other error, so it falls through to regular server error handling. Note: the JSON round-trip is lossy
// for the uncommon case of symbol or numeric validation keys (the validation shape normally has string
// keys). The `__proto__` reviver is defense-in-depth: `JSON.parse` already stores `__proto__` as a plain
// own property (it does not pollute the global prototype), but dropping it keeps a hostile key out of the
// recovered object entirely.
export function extractServerValidationErrors(e: unknown): ValidationErrors<any> | undefined {
	if (typeof e === "object" && e !== null && "digest" in e && typeof e.digest === "string") {
		// Split on the first `;` only, since the JSON payload itself may contain `;`.
		const sep = e.digest.indexOf(";");
		if (sep !== -1 && e.digest.slice(0, sep) === SERVER_VALIDATION_ERROR_DIGEST) {
			try {
				return JSON.parse(e.digest.slice(sep + 1), (key, value) =>
					key === "__proto__" ? undefined : value
				) as ValidationErrors<any>;
			} catch {
				// Malformed payload: fall through to server error handling instead of crashing.
				return undefined;
			}
		}
	}

	return undefined;
}

// This class is internally used to throw validation errors in action's server code function, using
// `returnValidationErrors`.
export class ActionValidationError<ShapedErrors> extends Error {
	public validationErrors: ShapedErrors;
	constructor(validationErrors: ShapedErrors, overriddenErrorMessage?: string) {
		super(overriddenErrorMessage ?? "Server Action validation error(s) occurred");
		this.validationErrors = validationErrors;
	}
}

// This class is internally used to throw validation errors in action's server code function, using
// `returnValidationErrors`.
export class ActionBindArgsValidationError extends Error {
	public validationErrors: unknown[];
	constructor(validationErrors: unknown[]) {
		super("Server Action bind args validation error(s) occurred");
		this.validationErrors = validationErrors;
	}
}

/**
 * Return custom validation errors to the client from the action's server code function.
 * Code declared after this function invocation will not be executed.
 * @param schema Input schema
 * @param validationErrors Validation errors object
 *
 * {@link https://next-safe-action.dev/docs/define-actions/validation-errors#returnvalidationerrors See docs for more information}
 */
export function returnValidationErrors<
	Schema extends StandardSchemaV1 | (() => Promise<StandardSchemaV1>),
	AS extends StandardSchemaV1 = Schema extends () => Promise<StandardSchemaV1> ? Awaited<ReturnType<Schema>> : Schema, // actual schema
>(schema: Schema, validationErrors: ValidationErrors<AS>): never {
	throw new ActionServerValidationError<AS>(validationErrors);
}

/**
 * Default validation errors format.
 * Emulation of `zod`'s [`format`](https://zod.dev/ERROR_HANDLING?id=formatting-errors) function.
 */
export function formatValidationErrors<VE extends ValidationErrors<any>>(validationErrors: VE) {
	return validationErrors;
}

/**
 * Transform default formatted validation errors into flattened structure.
 * `formErrors` contains global errors, and `fieldErrors` contains errors for each field,
 * one level deep. It discards errors for nested fields.
 * Emulation of `zod`'s [`flatten`](https://zod.dev/ERROR_HANDLING?id=flattening-errors) function.
 * @param {ValidationErrors} [validationErrors] Validation errors object
 *
 * {@link https://next-safe-action.dev/docs/define-actions/validation-errors#flattenvalidationerrorsutility-function See docs for more information}
 */
export function flattenValidationErrors<VE extends ValidationErrors<any>>(validationErrors: VE) {
	const flattened: FlattenedValidationErrors<VE> = {
		formErrors: [],
		fieldErrors: {},
	};

	for (const [key, value] of Object.entries<string[] | { _errors: string[] }>(validationErrors ?? {})) {
		if (key === "_errors" && Array.isArray(value)) {
			flattened.formErrors = [...value];
		} else {
			if (value !== null && typeof value === "object" && "_errors" in value) {
				// `setOwnProperty` so a hostile `__proto__` field key (possible when the input is a recovered
				// digest payload) is stored as a plain own property instead of reassigning the prototype.
				setOwnProperty(flattened.fieldErrors, key, [...value._errors]);
			}
		}
	}

	return flattened;
}

/**
 * This error is thrown when an action metadata is invalid, i.e. when there's a mismatch between the
 * type of the metadata schema returned from `defineMetadataSchema` and the actual data passed.
 */
export class ActionMetadataValidationError<MDS extends StandardSchemaV1 | undefined> extends Error {
	public validationErrors: ValidationErrors<MDS>;

	constructor(validationErrors: ValidationErrors<MDS>) {
		super("Invalid metadata input. Please be sure to pass metadata via `metadata` method before defining the action.");
		this.name = "ActionMetadataError";
		this.validationErrors = validationErrors;
	}
}

/**
 * This error is thrown when an action's data (output) is invalid, i.e. when there's a mismatch between the
 * type of the data schema passed to `dataSchema` method and the actual return of the action.
 */
export class ActionOutputDataValidationError<DS extends StandardSchemaV1 | undefined> extends Error {
	public validationErrors: ValidationErrors<DS>;

	constructor(validationErrors: ValidationErrors<DS>) {
		super(
			"Invalid action data (output). Please be sure to return data following the shape of the schema passed to `dataSchema` method."
		);
		this.name = "ActionOutputDataError";
		this.validationErrors = validationErrors;
	}
}
