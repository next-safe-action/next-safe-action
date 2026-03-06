import { PageHeader } from "@/components/page-header";
import { readAndHighlightFile } from "@/lib/shiki";
import { CoreActionsClient } from "./_components/core-actions-client";

export default async function CoreActionsPage() {
	const [directAction, asyncSchemaAction, authContextAction, noArgsAction, emptyResponseAction, outputSchemaAction] =
		await Promise.all([
			readAndHighlightFile("core-actions/_actions/direct-action.ts"),
			readAndHighlightFile("core-actions/_actions/async-schema-action.ts"),
			readAndHighlightFile("core-actions/_actions/auth-context-action.ts"),
			readAndHighlightFile("core-actions/_actions/no-args-action.ts"),
			readAndHighlightFile("core-actions/_actions/empty-response-action.ts"),
			readAndHighlightFile("core-actions/_actions/output-schema-action.ts"),
		]);

	return (
		<div>
			<PageHeader
				title="Core Actions"
				description="Basic action patterns: direct calls, async schemas, auth context, and output validation."
			/>
			<CoreActionsClient
				sources={{
					directAction,
					asyncSchemaAction,
					authContextAction,
					noArgsAction,
					emptyResponseAction,
					outputSchemaAction,
				}}
			/>
		</div>
	);
}
