/* oxlint-disable typescript/no-unsafe-member-access, typescript/no-unsafe-assignment */
import type { StandardSchemaV1 } from "./standard-schema";
import type { FlattenedValidationErrors, IssueWithUnionErrors, ValidationErrors } from "./validation-errors.types";

const getKey = (segment: PropertyKey | StandardSchemaV1.PathSegment) =>
	typeof segment === "object" ? segment.key : segment;

const getIssueMessage = (issue: IssueWithUnionErrors) => {
	if (issue.unionErrors) {
		return issue.unionErrors.map((u) => u.issues.map((i) => i.message)).flat();
	}
	return issue.message;
};

// This function is used internally to build the validation errors object from a list of validation issues.
export const buildValidationErrors = <S extends StandardSchemaV1 | undefined>(
	issues: readonly IssueWithUnionErrors[]
) => {
	const ve: any = {};

	for (const issue of issues) {
		const { path, message, unionErrors } = issue;

		// When path is undefined or empty, set root errors.
		if (!path || path.length === 0) {
			ve._errors = ve._errors ? [...ve._errors, message] : [message];
			continue;
		}

		// Reference to errors object.
		let ref = ve;

		// Set object for the path, if it doesn't exist.
		for (let i = 0; i < path.length - 1; i++) {
			const k = getKey(path[i]!);

			if (!ref[k]) {
				ref[k] = {};
			}

			ref = ref[k];
		}

		// Key is always the last element of the path.
		const key = getKey(path[path.length - 1]!);

		const issueMessage = getIssueMessage(issue);

		// Set error for the current path. If `_errors` array exists, add the message to it.
		ref[key] = ref[key]?._errors
			? {
					...structuredClone(ref[key]),
					_errors: [...ref[key]._errors, issueMessage],
				}
			: { ...structuredClone(ref[key]), _errors: unionErrors ? issueMessage : [issueMessage] };
	}

	return ve as ValidationErrors<S>;
};

// This class is internally used to throw validation errors in action's server code function, using
// `returnValidationErrors`.
export class ActionServerValidationError<S extends StandardSchemaV1> extends Error {
	public validationErrors: ValidationErrors<S>;
	constructor(validationErrors: ValidationErrors<S>) {
		super("Server Action server validation error(s) occurred");
		this.validationErrors = validationErrors;
	}
}

// This class is internally used to throw validation errors in action's server code function, using
// `returnValidationErrors`.
export class ActionValidationError<CVE> extends Error {
	public validationErrors: CVE;
	constructor(validationErrors: CVE, overriddenErrorMessage?: string) {
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
	S extends StandardSchemaV1 | (() => Promise<StandardSchemaV1>),
	AS extends StandardSchemaV1 = S extends () => Promise<StandardSchemaV1> ? Awaited<ReturnType<S>> : S, // actual schema
>(schema: S, validationErrors: ValidationErrors<AS>): never {
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
			if ("_errors" in value) {
				flattened.fieldErrors[key as keyof Omit<VE, "_errors">] = [...value._errors];
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
