import { PageHeader } from "@/components/page-header";
import { readAndHighlightFile } from "@/lib/shiki";
import { ValidationErrorsClient } from "./_components/validation-errors-client";

export default async function ValidationErrorsPage() {
	const [formattedAction, flattenedAction, nestedAction, throwingAction, customShapeAction] = await Promise.all([
		readAndHighlightFile("validation-errors/_actions/formatted-action.ts"),
		readAndHighlightFile("validation-errors/_actions/flattened-action.ts"),
		readAndHighlightFile("validation-errors/_actions/nested-action.ts"),
		readAndHighlightFile("validation-errors/_actions/throwing-action.ts"),
		readAndHighlightFile("validation-errors/_actions/custom-shape-action.ts"),
	]);

	return (
		<div>
			<PageHeader
				title="Validation Errors"
				description="Different validation error shapes, nested schemas, and custom error handling."
			/>
			<ValidationErrorsClient
				sources={{
					formattedAction,
					flattenedAction,
					nestedAction,
					throwingAction,
					customShapeAction,
				}}
			/>
		</div>
	);
}
