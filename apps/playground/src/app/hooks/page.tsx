import { PageHeader } from "@/components/page-header";
import { readAndHighlightFile } from "@/lib/shiki";
import { HookDemo } from "./_components/hook-demo";
import { StateUpdateDemo } from "./_components/state-update-demo";
import { StatelessFormDemo } from "./_components/stateless-form-demo";

export default async function HooksPage() {
	const [deleteUserSource, statelessFormSource, stateUpdateSource] = await Promise.all([
		readAndHighlightFile("hooks/_actions/delete-user-action.ts"),
		readAndHighlightFile("hooks/_actions/stateless-form-action.ts"),
		readAndHighlightFile("hooks/_actions/state-update-action.ts"),
	]);

	return (
		<div>
			<PageHeader
				title="React Hooks"
				description="useAction hook with full status tracking, callbacks, forms, and state updates."
			/>
			<div className="space-y-6">
				<HookDemo source={deleteUserSource} />
				<StatelessFormDemo source={statelessFormSource} />
				<StateUpdateDemo source={stateUpdateSource} />
			</div>
		</div>
	);
}
