import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { readAndHighlightFile } from "@/lib/shiki";
import { NavigationClient } from "./_components/navigation-client";

export default async function NavigationFrameworkPage() {
	await connection();
	const navigationSource = await readAndHighlightFile("navigation-framework/_actions/navigation-action.ts");

	return (
		<div>
			<PageHeader
				title="Navigation & Framework"
				description="Server action navigation functions: redirect, notFound, forbidden, unauthorized."
			/>
			<NavigationClient source={navigationSource} />
		</div>
	);
}
