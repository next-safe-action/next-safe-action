import { PageHeader } from "@/components/page-header";
import { getItems } from "./_actions/add-item-action";
import { ErrorMapperDemo } from "./_components/error-mapper-demo";
import { HookFormActionDemo } from "./_components/hook-form-action-demo";
import { HookFormOptimisticDemo } from "./_components/hook-form-optimistic-demo";

export default async function ReactHookFormPage() {
	const items = await getItems();

	return (
		<div>
			<PageHeader
				title="React Hook Form"
				description="All three adapter hooks from @next-safe-action/adapter-react-hook-form."
			/>
			<div className="space-y-6">
				<HookFormActionDemo />
				<HookFormOptimisticDemo items={items} />
				<ErrorMapperDemo />
			</div>
		</div>
	);
}
