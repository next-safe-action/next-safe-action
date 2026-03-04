import type { ValidationErrors } from "next-safe-action";
import type { FieldError, FieldErrors } from "react-hook-form";
import type {} from "zod";
import type { ErrorMapperProps } from "./index.types";
import type { InferOutputOrDefault, StandardSchemaV1 } from "./standard-schema";

/**
 * Maps a validation errors object to an object of `FieldErrors` compatible with react-hook-form.
 * You should only call this function directly for advanced use cases, and prefer exported hooks.
 */
export function mapToHookFormErrors<S extends StandardSchemaV1 | undefined>(
	validationErrors: ValidationErrors<S> | undefined,
	props?: ErrorMapperProps
) {
	if (!validationErrors || Object.keys(validationErrors).length === 0) {
		return undefined;
	}

	const fieldErrors: FieldErrors<InferOutputOrDefault<S, any>> = {};

	function mapper(ve: Record<string, any>, paths: string[] = []) {
		// Map through validation errors.
		for (const key of Object.keys(ve)) {
			// If validation error is an object, recursively call mapper so we go one level deeper
			// at a time. Pass the current paths to the mapper as well.
			if (typeof ve[key] === "object" && ve[key] && !Array.isArray(ve[key])) {
				mapper(ve[key], [...paths, key]);
			}

			// We're just interested in the `_errors` field, which must be an array.
			if (key === "_errors" && Array.isArray(ve[key])) {
				// Initially set moving reference to root `fieldErrors` object.
				let ref = fieldErrors as Record<string, any>;

				// Iterate through the paths, create nested objects if needed and move the reference.
				for (let i = 0; i < paths.length - 1; i++) {
					const p = paths[i]!;
					ref[p] ??= {};
					ref = ref[p];
				}

				// The actual path is the last one. If it's undefined, it means that we're at the root level.
				const path = paths.at(-1) ?? "root";

				// Set the error for the current path.
				ref[path] = {
					type: "validate",
					message: ve[key].join(props?.joinBy ?? " "),
				} as FieldError;
			}
		}
	}

	mapper(validationErrors ?? {});
	return fieldErrors;
}

export type * from "./index.types";
