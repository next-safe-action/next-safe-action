import { Separator } from "@/components/ui/separator";

type Props = {
	title: string;
	description: string;
};

export function PageHeader({ title, description }: Props) {
	return (
		<div className="mb-8">
			<h1 className="text-3xl font-bold tracking-tight">{title}</h1>
			<p className="text-muted-foreground mt-2">{description}</p>
			<Separator className="mt-6" />
		</div>
	);
}
