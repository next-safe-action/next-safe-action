"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buyProduct } from "../_actions/buy-product-action";
import { buyProductSchema } from "../_validation/schemas";

export function HookFormActionDemo() {
	const { form, action, handleSubmitWithAction, resetFormAndAction } = useHookFormAction(
		buyProduct,
		zodResolver(buyProductSchema),
		{
			actionProps: {
				onSuccess({ data }) {
					console.log("onSuccess:", data);
				},
				onError({ error }) {
					console.log("onError:", error);
				},
			},
			formProps: {
				defaultValues: {
					productId: "",
					quantity: 1,
				},
			},
		}
	);

	const { errors } = form.formState;

	return (
		<ExampleCard
			title="useHookFormAction"
			description="Full integration: zodResolver, handleSubmitWithAction, resetFormAndAction, server validation error mapping."
		>
			<form onSubmit={handleSubmitWithAction} className="space-y-4">
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="rhf-productId">Product ID</Label>
						<Input id="rhf-productId" placeholder='Try "out-of-stock"' {...form.register("productId")} />
						{errors.productId ? <p className="text-destructive text-sm">{errors.productId.message}</p> : null}
					</div>
					<div className="space-y-2">
						<Label htmlFor="rhf-quantity">Quantity</Label>
						<Input id="rhf-quantity" type="number" {...form.register("quantity")} />
						{errors.quantity ? <p className="text-destructive text-sm">{errors.quantity.message}</p> : null}
					</div>
				</div>
				<div className="flex gap-2">
					<Button type="submit" disabled={action.isPending}>
						{action.isPending ? "Purchasing..." : "Buy product"}
					</Button>
					<Button type="button" variant="outline" onClick={resetFormAndAction}>
						Reset
					</Button>
				</div>
			</form>

			<div className="mt-3 flex items-center gap-2">
				<span className="text-sm font-medium">Status:</span>
				<StatusBadge status={action.status} />
			</div>

			<ResultDisplay result={action.result} />
		</ExampleCard>
	);
}
