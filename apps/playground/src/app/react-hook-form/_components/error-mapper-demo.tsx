"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormActionErrorMapper } from "@next-safe-action/adapter-react-hook-form/hooks";
import { useAction } from "next-safe-action/hooks";
import { useForm } from "react-hook-form";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buyProduct } from "../_actions/buy-product-action";
import { buyProductSchema } from "../_validation/schemas";

export function ErrorMapperDemo() {
	const { execute, result, status, reset: resetAction, isPending } = useAction(buyProduct);

	const { hookFormValidationErrors } = useHookFormActionErrorMapper(result.validationErrors);

	const {
		register,
		handleSubmit,
		reset: resetForm,
		formState: { errors },
	} = useForm({
		resolver: zodResolver(buyProductSchema),
		errors: hookFormValidationErrors,
		defaultValues: {
			productId: "",
			quantity: 1,
		},
	});

	return (
		<ExampleCard
			title="useHookFormActionErrorMapper"
			description="Advanced pattern: separate useAction + useForm with the error mapper hook for custom control."
		>
			<form
				onSubmit={handleSubmit(async (data) => {
					execute(data);
				})}
				className="space-y-4"
			>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="mapper-productId">Product ID</Label>
						<Input id="mapper-productId" placeholder='Try "out-of-stock"' {...register("productId")} />
						{errors.productId?.message ? (
							<p className="text-destructive text-sm">{errors.productId.message as string}</p>
						) : null}
					</div>
					<div className="space-y-2">
						<Label htmlFor="mapper-quantity">Quantity</Label>
						<Input id="mapper-quantity" type="number" {...register("quantity")} />
						{errors.quantity?.message ? (
							<p className="text-destructive text-sm">{errors.quantity.message as string}</p>
						) : null}
					</div>
				</div>
				<div className="flex gap-2">
					<Button type="submit" disabled={isPending}>
						{isPending ? "Purchasing..." : "Buy product"}
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							resetForm();
							resetAction();
						}}
					>
						Reset
					</Button>
				</div>
			</form>

			<div className="mt-3 flex items-center gap-2">
				<span className="text-sm font-medium">Status:</span>
				<StatusBadge status={status} />
			</div>

			<ResultDisplay result={result} />
		</ExampleCard>
	);
}
