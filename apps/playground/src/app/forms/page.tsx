import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { BindArgumentsDemo } from "./_components/bind-arguments-demo";
import { FileUploadDemo } from "./_components/file-upload-demo";
import { StatefulFormDemo } from "./_components/stateful-form-demo";

async function BindArgumentsSection() {
	await connection();
	const randomAge = Math.floor(Math.random() * 200);
	const randomUserId = crypto.randomUUID();

	return <BindArgumentsDemo age={randomAge} userId={randomUserId} />;
}

export default function FormsPage() {
	return (
		<div>
			<PageHeader
				title="Form Integration"
				description="Stateful forms with useActionState, file uploads, and bind arguments."
			/>
			<div className="space-y-6">
				<StatefulFormDemo />
				<FileUploadDemo />
				<Suspense fallback={<p className="text-muted-foreground text-sm">Loading bind arguments...</p>}>
					<BindArgumentsSection />
				</Suspense>
			</div>
		</div>
	);
}
