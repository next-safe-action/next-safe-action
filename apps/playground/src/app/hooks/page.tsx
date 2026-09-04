import { PageHeader } from "@/components/page-header";
import { readAndHighlightFile } from "@/lib/shiki";
import { FormActionStatusDemo } from "./_components/form-action-status-demo";
import { HookDemo } from "./_components/hook-demo";
import { InitResultDemo } from "./_components/init-result-demo";
import { RouteActionDemo } from "./_components/route-action-demo";
import { StateUpdateDemo } from "./_components/state-update-demo";
import { StatelessFormDemo } from "./_components/stateless-form-demo";

export default async function HooksPage() {
	const [deleteUserSource, statelessFormSource, stateUpdateSource, initResultSource, formActionStatusSource] =
		await Promise.all([
			readAndHighlightFile("hooks/_actions/delete-user-action.ts"),
			readAndHighlightFile("hooks/_actions/stateless-form-action.ts"),
			readAndHighlightFile("hooks/_actions/state-update-action.ts"),
			readAndHighlightFile("hooks/_components/init-result-demo.tsx"),
			readAndHighlightFile("hooks/_components/form-action-status-demo.tsx"),
		]);

	return (
		<div>
			<PageHeader
				title="React Hooks"
				description="useAction hook with full status tracking, callbacks, forms, and state updates."
			/>
			<div className="space-y-6">
				<HookDemo source={deleteUserSource} />
				<RouteActionDemo />
				<InitResultDemo source={initResultSource} />
				<StatelessFormDemo source={statelessFormSource} />
				<FormActionStatusDemo source={formActionStatusSource} />
				<StateUpdateDemo source={stateUpdateSource} />
			</div>
		</div>
	);
}
