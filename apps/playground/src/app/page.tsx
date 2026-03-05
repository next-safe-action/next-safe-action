import {
	BoxIcon,
	CircuitBoardIcon,
	FileTextIcon,
	LayersIcon,
	MousePointerClickIcon,
	NavigationIcon,
	ShieldAlertIcon,
	SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const pages = [
	{
		title: "Core Actions",
		description: "Direct calls, async schemas, auth context, output schemas",
		href: "/core-actions",
		icon: BoxIcon,
	},
	{
		title: "Validation Errors",
		description: "Formatted, flattened, nested, custom error shapes",
		href: "/validation-errors",
		icon: ShieldAlertIcon,
	},
	{
		title: "Middleware",
		description: "Logging, auth chains, standalone middleware, rate limiting",
		href: "/middleware",
		icon: LayersIcon,
	},
	{
		title: "React Hooks",
		description: "useAction, callbacks, stateless forms, state updates",
		href: "/hooks",
		icon: MousePointerClickIcon,
	},
	{
		title: "Optimistic Updates",
		description: "useOptimisticAction with instant UI updates and revalidation",
		href: "/optimistic-updates",
		icon: SparklesIcon,
	},
	{
		title: "Form Integration",
		description: "Stateful forms, file uploads, bind arguments",
		href: "/forms",
		icon: FileTextIcon,
	},
	{
		title: "React Hook Form",
		description: "Adapter hooks for react-hook-form integration",
		href: "/react-hook-form",
		icon: CircuitBoardIcon,
	},
	{
		title: "Navigation & Framework",
		description: "Redirects, notFound, forbidden, unauthorized",
		href: "/navigation-framework",
		icon: NavigationIcon,
	},
];

export default function Home() {
	return (
		<div>
			<div className="mb-8">
				<h1 className="text-3xl font-bold tracking-tight">Playground</h1>
				<p className="text-muted-foreground mt-2">
					Interactive examples showcasing every feature of the next-safe-action library.
				</p>
			</div>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{pages.map((page) => (
					<Link key={page.href} href={page.href}>
						<Card className="hover:bg-muted/50 transition-colors">
							<CardHeader>
								<div className="flex items-center gap-2">
									<page.icon className="text-muted-foreground size-5" />
									<CardTitle className="text-base">{page.title}</CardTitle>
								</div>
								<CardDescription>{page.description}</CardDescription>
							</CardHeader>
						</Card>
					</Link>
				))}
			</div>
		</div>
	);
}
