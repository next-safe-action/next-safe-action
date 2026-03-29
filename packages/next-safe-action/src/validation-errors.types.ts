import type { InferInputArray, InferInputOrDefault, StandardSchemaV1 } from "./standard-schema";
import type { MaybeArray, Prettify } from "./utils.types";

// Basic types and arrays.
type PrimitiveOrArray = number | string | boolean | bigint | symbol | null | undefined | any[];

// Object with an optional list of validation errors.
type ValidationErrorNode<K = undefined> = K extends any[] ? MaybeArray<{ _errors?: string[] }> : { _errors?: string[] };

// Creates nested schema validation errors type using recursion.
type SchemaErrors<Schema> = {
	[K in keyof Schema]?: Schema[K] extends PrimitiveOrArray
		? Prettify<ValidationErrorNode<Schema[K]>>
		: Prettify<ValidationErrorNode> & SchemaErrors<Schema[K]>;
} & {};

export type IssueWithUnionErrors = StandardSchemaV1.Issue & {
	unionErrors?: { issues: StandardSchemaV1.Issue[] }[];
};

/**
 * Type of the returned object when validation fails.
 */
export type ValidationErrors<Schema extends StandardSchemaV1 | undefined> = Schema extends StandardSchemaV1
	? StandardSchemaV1.InferOutput<Schema> extends PrimitiveOrArray
		? Prettify<ValidationErrorNode>
		: Prettify<ValidationErrorNode> & SchemaErrors<StandardSchemaV1.InferOutput<Schema>>
	: undefined;

/**
 * Type of flattened validation errors. `formErrors` contains global errors, and `fieldErrors`
 * contains errors for each field, one level deep.
 */
export type FlattenedValidationErrors<VE extends ValidationErrors<any>> = Prettify<{
	formErrors: string[];
	fieldErrors: {
		[K in keyof Omit<VE, "_errors">]?: string[];
	};
}>;

/**
 * Type of the function used to format validation errors.
 */
export type HandleValidationErrorsShapeFn<
	Schema extends StandardSchemaV1 | undefined,
	BindArgsSchemas extends readonly StandardSchemaV1[],
	Metadata,
	Ctx extends object,
	ShapedErrors,
> = (
	validationErrors: ValidationErrors<Schema>,
	utils: {
		clientInput: InferInputOrDefault<Schema, undefined>;
		bindArgsClientInputs: InferInputArray<BindArgsSchemas>;
		metadata: Metadata;
		ctx: Prettify<Ctx>;
	}
) => Promise<ShapedErrors>;
