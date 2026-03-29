import type { ValidationErrors } from "next-safe-action";
import type { FieldError, FieldErrors } from "react-hook-form";
import type { ErrorMapperProps } from "./index.types";
import type { InferOutputOrDefault, StandardSchemaV1 } from "./standard-schema";

/**
 * Maps a validation errors object to an object of `FieldErrors` compatible with react-hook-form.
 * You should only call this function directly for advanced use cases, and prefer exported hooks.
 */
export function mapToHookFormErrors<Schema extends StandardSchemaV1 | undefined>(
	validationErrors: ValidationErrors<Schema> | undefined,
	props?: ErrorMapperProps
) {
	if (!validationErrors || Object.keys(validationErrors).length === 0) {
		return undefined;
	}

	const fieldErrors: FieldErrors<InferOutputOrDefault<Schema, any>> = {};

	function mapper(ve: Record<string, any>, paths: string[] = []) {
		for (const key of Object.keys(ve)) {
			// `_errors` arrays are the leaf values: extract them as FieldError objects.
			if (key === "_errors" && Array.isArray(ve[key])) {
				let ref = fieldErrors as Record<string, any>;

				// Build nested path structure.
				for (let i = 0; i < paths.length - 1; i++) {
					const p = paths[i]!;
					ref[p] ??= {};
					ref = ref[p];
				}

				// The actual field path is the last segment. Root-level errors use "root".
				const path = paths.at(-1) ?? "root";

				ref[path] = {
					type: "validate",
					message: ve[key].join(props?.joinBy ?? " "),
				} as FieldError;
				continue;
			}

			// Recurse into nested objects (but not arrays or primitives).
			if (typeof ve[key] === "object" && ve[key] && !Array.isArray(ve[key])) {
				mapper(ve[key], [...paths, key]);
			}
		}
	}

	mapper(validationErrors ?? {});
	return fieldErrors;
}

export type * from "./index.types";
