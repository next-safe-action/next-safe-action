import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { readAndHighlightFile } from "@/lib/shiki";
import type { SourceCode } from "@/lib/shiki";
import { BindArgumentsDemo } from "./_components/bind-arguments-demo";
import { FileUploadDemo } from "./_components/file-upload-demo";
import { StatefulFormDemo } from "./_components/stateful-form-demo";

async function BindArgumentsSection({ source }: { source: SourceCode }) {
	await connection();
	const randomAge = Math.floor(Math.random() * 200);
	const randomUserId = crypto.randomUUID();

	return <BindArgumentsDemo age={randomAge} userId={randomUserId} source={source} />;
}

export default async function FormsPage() {
	const [statefulFormSource, fileUploadSource, onboardSource] = await Promise.all([
		readAndHighlightFile("forms/_actions/stateful-form-action.ts"),
		readAndHighlightFile("forms/_actions/file-upload-action.ts"),
		readAndHighlightFile("forms/_actions/onboard-action.ts"),
	]);

	return (
		<div>
			<PageHeader
				title="Form Integration"
				description="Stateful forms with useActionState, file uploads, and bind arguments."
			/>
			<div className="space-y-6">
				<StatefulFormDemo source={statefulFormSource} />
				<FileUploadDemo source={fileUploadSource} />
				<Suspense fallback={<p className="text-muted-foreground text-sm">Loading bind arguments...</p>}>
					<BindArgumentsSection source={onboardSource} />
				</Suspense>
			</div>
		</div>
	);
}
