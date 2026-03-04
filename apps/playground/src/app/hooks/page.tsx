import { PageHeader } from "@/components/page-header";
import { HookDemo } from "./_components/hook-demo";
import { StateUpdateDemo } from "./_components/state-update-demo";
import { StatelessFormDemo } from "./_components/stateless-form-demo";

export default function HooksPage() {
	return (
		<div>
			<PageHeader
				title="React Hooks"
				description="useAction hook with full status tracking, callbacks, forms, and state updates."
			/>
			<div className="space-y-6">
				<HookDemo />
				<StatelessFormDemo />
				<StateUpdateDemo />
			</div>
		</div>
	);
}
