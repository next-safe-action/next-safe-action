"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormOptimisticAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SourceCode } from "@/lib/shiki";
import type { Item } from "../_actions/add-item-action";
import { addItem } from "../_actions/add-item-action";
import { addItemSchema } from "../_validation/schemas";

type Props = {
	items: Item[];
	source?: SourceCode;
};

export function HookFormOptimisticDemo({ items, source }: Props) {
	const { form, action, handleSubmitWithAction, resetFormAndAction } = useHookFormOptimisticAction(
		addItem,
		zodResolver(addItemSchema),
		{
			actionProps: {
				currentState: { items },
				updateFn: (state, input) => ({
					items: [...state.items, { ...input, id: crypto.randomUUID() }],
				}),
				onSuccess() {
					form.reset();
				},
			},
			formProps: {
				defaultValues: {
					name: "",
				},
			},
		}
	);

	const { errors } = form.formState;

	return (
		<ExampleCard
			title="useHookFormOptimisticAction"
			description="Optimistic form with currentState/updateFn, items appear instantly before server confirms."
			source={source}
		>
			<form onSubmit={handleSubmitWithAction} className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="rhf-opt-name">Item name</Label>
					<Input id="rhf-opt-name" placeholder="New item" {...form.register("name")} />
					{errors.name ? <p className="text-destructive text-sm">{errors.name.message}</p> : null}
				</div>
				<div className="flex gap-2">
					<Button type="submit" disabled={action.isPending}>
						{action.isPending ? "Adding..." : "Add item"}
					</Button>
					<Button type="button" variant="outline" onClick={resetFormAndAction}>
						Reset
					</Button>
				</div>
			</form>

			{action.optimisticState.items.length > 0 ? (
				<ul className="mt-4 space-y-2">
					{action.optimisticState.items.map((item) => (
						<li key={item.id} className="rounded-md border p-2 text-sm">
							{item.name}
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted-foreground mt-4 text-sm">No items yet.</p>
			)}

			<ResultDisplay result={action.optimisticState} status={action.status} label="Optimistic state:" />
		</ExampleCard>
	);
}
