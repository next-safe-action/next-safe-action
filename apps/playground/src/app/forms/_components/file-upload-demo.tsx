"use client";

import { useAction } from "next-safe-action/hooks";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SourceCode } from "@/lib/shiki";
import { fileUploadAction } from "../_actions/file-upload-action";

type Props = {
	source?: SourceCode;
};

export function FileUploadDemo({ source }: Props) {
	const { execute, result, status } = useAction(fileUploadAction);

	return (
		<ExampleCard
			title="File Upload"
			description="Using zod-form-data with zfd.file() schema to validate file uploads."
			source={source}
		>
			<form action={execute} className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="file-image">Image</Label>
					<Input id="file-image" type="file" name="image" accept="image/*" />
				</div>
				<Button type="submit">Upload</Button>
			</form>
			<ResultDisplay result={result} status={status} />
		</ExampleCard>
	);
}
