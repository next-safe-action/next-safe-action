"use client";

import {
	BoxIcon,
	CircuitBoardIcon,
	FileTextIcon,
	GithubIcon,
	HomeIcon,
	LayersIcon,
	MousePointerClickIcon,
	NavigationIcon,
	ShieldAlertIcon,
	SparklesIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";

const navGroups = [
	{
		label: "Overview",
		items: [{ title: "Home", href: "/", icon: HomeIcon }],
	},
	{
		label: "Core",
		items: [
			{ title: "Core Actions", href: "/core-actions", icon: BoxIcon },
			{ title: "Validation Errors", href: "/validation-errors", icon: ShieldAlertIcon },
			{ title: "Middleware", href: "/middleware", icon: LayersIcon },
		],
	},
	{
		label: "Hooks",
		items: [
			{ title: "React Hooks", href: "/hooks", icon: MousePointerClickIcon },
			{ title: "Optimistic Updates", href: "/optimistic-updates", icon: SparklesIcon },
		],
	},
	{
		label: "Forms",
		items: [
			{ title: "Form Integration", href: "/forms", icon: FileTextIcon },
			{ title: "React Hook Form", href: "/react-hook-form", icon: CircuitBoardIcon },
		],
	},
	{
		label: "Framework",
		items: [{ title: "Navigation & Framework", href: "/navigation-framework", icon: NavigationIcon }],
	},
];

export function AppSidebar() {
	const pathname = usePathname();

	return (
		<Sidebar>
			<SidebarHeader>
				<div className="flex items-center gap-2 px-2 py-1">
					<Image src="/img/logo-light-mode.svg" alt="" width={26} height={20} className="dark:hidden" />
					<Image src="/img/logo-dark-mode.svg" alt="" width={26} height={20} className="hidden dark:block" />
					<div className="flex flex-col">
						<span className="text-sm leading-none font-semibold">next-safe-action</span>
						<span className="text-muted-foreground text-xs">playground</span>
					</div>
				</div>
			</SidebarHeader>
			<SidebarContent>
				{navGroups.map((group) => (
					<SidebarGroup key={group.label}>
						<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{group.items.map((item) => (
									<SidebarMenuItem key={item.href}>
										<SidebarMenuButton asChild isActive={pathname === item.href}>
											<Link href={item.href}>
												<item.icon className="size-4" />
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>
			<SidebarFooter>
				<div className="flex w-full items-center justify-between">
					<SidebarMenu className="w-auto flex-1">
						<SidebarMenuItem>
							<SidebarMenuButton asChild>
								<a href="https://github.com/TheEdoRan/next-safe-action" target="_blank" rel="noopener noreferrer">
									<GithubIcon className="size-4" />
									<span>GitHub</span>
								</a>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
					<ThemeToggle />
				</div>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
