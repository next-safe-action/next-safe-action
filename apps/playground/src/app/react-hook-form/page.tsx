import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { readAndHighlightFile } from "@/lib/shiki";
import { getItems } from "./_actions/add-item-action";
import { ErrorMapperDemo } from "./_components/error-mapper-demo";
import { HookFormActionDemo } from "./_components/hook-form-action-demo";
import { HookFormOptimisticDemo } from "./_components/hook-form-optimistic-demo";

export default async function ReactHookFormPage() {
	await connection();

	const [items, buyProductSource, addItemSource] = await Promise.all([
		getItems(),
		readAndHighlightFile("react-hook-form/_actions/buy-product-action.ts"),
		readAndHighlightFile("react-hook-form/_actions/add-item-action.ts"),
	]);

	return (
		<div>
			<PageHeader
				title="React Hook Form"
				description="All three adapter hooks from @next-safe-action/adapter-react-hook-form."
			/>
			<div className="space-y-6">
				<HookFormActionDemo source={buyProductSource} />
				<HookFormOptimisticDemo items={items} source={addItemSource} />
				<ErrorMapperDemo source={buyProductSource} />
			</div>
		</div>
	);
}
