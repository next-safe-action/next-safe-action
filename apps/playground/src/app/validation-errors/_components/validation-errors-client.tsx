"use client";

import { useState } from "react";
import { ExampleCard } from "@/components/example-card";
import { ResultDisplay } from "@/components/result-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SourceCode } from "@/lib/shiki";
import { customShapeAction } from "../_actions/custom-shape-action";
import { flattenedAction } from "../_actions/flattened-action";
import { formattedAction } from "../_actions/formatted-action";
import { nestedAction } from "../_actions/nested-action";
import { throwingValidationAction } from "../_actions/throwing-action";

type Props = {
	sources: {
		formattedAction: SourceCode;
		flattenedAction: SourceCode;
		nestedAction: SourceCode;
		throwingAction: SourceCode;
		customShapeAction: SourceCode;
	};
};

export function ValidationErrorsClient({ sources }: Props) {
	const [formattedResult, setFormattedResult] = useState<any>(undefined);
	const [flattenedResult, setFlattenedResult] = useState<any>(undefined);
	const [nestedResult, setNestedResult] = useState<any>(undefined);
	const [throwingResult, setThrowingResult] = useState<any>(undefined);
	const [throwingError, setThrowingError] = useState<string | undefined>(undefined);
	const [customResult, setCustomResult] = useState<any>(undefined);

	return (
		<div className="space-y-6">
			<ExampleCard
				title="Formatted Errors (default)"
				description="Default validation error shape with nested _errors arrays."
				source={sources.formattedAction}
			>
				<form
					className="space-y-4"
					onSubmit={async (e) => {
						e.preventDefault();
						const formData = new FormData(e.currentTarget);
						const res = await formattedAction({
							username: formData.get("username") as string,
							password: formData.get("password") as string,
						});
						setFormattedResult(res);
					}}
				>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="formatted-username">Username</Label>
							<Input id="formatted-username" name="username" placeholder="user" />
						</div>
						<div className="space-y-2">
							<Label htmlFor="formatted-password">Password</Label>
							<Input id="formatted-password" name="password" type="password" placeholder="password" />
						</div>
					</div>
					<Button type="submit">Test formatted errors</Button>
				</form>
				<ResultDisplay result={formattedResult} />
			</ExampleCard>

			<ExampleCard
				title="Flattened Errors"
				description="Using flattenValidationErrors to get formErrors + fieldErrors shape."
				source={sources.flattenedAction}
			>
				<form
					className="space-y-4"
					onSubmit={async (e) => {
						e.preventDefault();
						const formData = new FormData(e.currentTarget);
						const res = await flattenedAction({
							username: formData.get("username") as string,
							password: formData.get("password") as string,
						});
						setFlattenedResult(res);
					}}
				>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="flattened-username">Username</Label>
							<Input id="flattened-username" name="username" placeholder="user" />
						</div>
						<div className="space-y-2">
							<Label htmlFor="flattened-password">Password</Label>
							<Input id="flattened-password" name="password" type="password" placeholder="password" />
						</div>
					</div>
					<Button type="submit">Test flattened errors</Button>
				</form>
				<ResultDisplay result={flattenedResult} />
			</ExampleCard>

			<ExampleCard
				title="Nested Schema"
				description="Complex nested Zod schema with superRefine producing random validation errors at different levels."
				source={sources.nestedAction}
			>
				<form
					className="space-y-4"
					onSubmit={async (e) => {
						e.preventDefault();
						const formData = new FormData(e.currentTarget);
						const res = await nestedAction({
							user: { id: formData.get("userId") as string },
							product: { deeplyNested: { id: formData.get("productId") as string } },
						});
						setNestedResult(res);
					}}
				>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="nested-userId">User ID (UUID)</Label>
							<Input id="nested-userId" name="userId" placeholder="Enter a UUID" />
						</div>
						<div className="space-y-2">
							<Label htmlFor="nested-productId">Product ID (UUID)</Label>
							<Input id="nested-productId" name="productId" placeholder="Enter a UUID" />
						</div>
					</div>
					<Button type="submit">Test nested errors</Button>
				</form>
				<ResultDisplay result={nestedResult} />
			</ExampleCard>

			<ExampleCard
				title="returnValidationErrors"
				description="Manually returning validation errors from server action code (use the formatted errors example above — try username 'johndoe')."
			>
				<p className="text-muted-foreground text-sm">
					The formatted and flattened examples above both use <code>returnValidationErrors</code> to manually set
					field-level errors from the server. Try username &quot;johndoe&quot; to see a <code>user_suspended</code>{" "}
					error, or any other value to see <code>incorrect_credentials</code>.
				</p>
			</ExampleCard>

			<ExampleCard
				title="throwValidationErrors"
				description="Client created with throwValidationErrors: true — validation errors throw instead of returning."
				source={sources.throwingAction}
			>
				<form
					className="space-y-4"
					onSubmit={async (e) => {
						e.preventDefault();
						setThrowingError(undefined);
						const formData = new FormData(e.currentTarget);
						try {
							const res = await throwingValidationAction({
								email: formData.get("email") as string,
								age: Number(formData.get("age")),
							});
							setThrowingResult(res);
						} catch (err) {
							setThrowingError(err instanceof Error ? err.message : String(err));
							setThrowingResult(undefined);
						}
					}}
				>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="throwing-email">Email</Label>
							<Input id="throwing-email" name="email" placeholder="test@example.com" />
						</div>
						<div className="space-y-2">
							<Label htmlFor="throwing-age">Age</Label>
							<Input id="throwing-age" name="age" type="number" placeholder="25" />
						</div>
					</div>
					<Button type="submit">Test throwing errors</Button>
				</form>
				{throwingError ? (
					<div className="border-destructive bg-destructive/10 mt-4 rounded-md border p-3">
						<p className="text-destructive text-sm font-medium">Caught error: {throwingError}</p>
					</div>
				) : null}
				<ResultDisplay result={throwingResult} />
			</ExampleCard>

			<ExampleCard
				title="Custom Error Shape"
				description="Using handleValidationErrorsShape to transform validation errors into a custom format."
				source={sources.customShapeAction}
			>
				<form
					className="space-y-4"
					onSubmit={async (e) => {
						e.preventDefault();
						const formData = new FormData(e.currentTarget);
						const res = await customShapeAction({
							email: formData.get("email") as string,
							name: formData.get("name") as string,
						});
						setCustomResult(res);
					}}
				>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="custom-email">Email</Label>
							<Input id="custom-email" name="email" placeholder="user@example.com" />
						</div>
						<div className="space-y-2">
							<Label htmlFor="custom-name">Name</Label>
							<Input id="custom-name" name="name" placeholder="John" />
						</div>
					</div>
					<Button type="submit">Test custom shape</Button>
				</form>
				<ResultDisplay result={customResult} />
			</ExampleCard>
		</div>
	);
}
