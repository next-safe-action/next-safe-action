"use client";

import {
	BoxIcon,
	CircuitBoardIcon,
	FileTextIcon,
	GithubIcon,
	HomeIcon,
	LayersIcon,
	MoonIcon,
	MousePointerClickIcon,
	NavigationIcon,
	ShieldAlertIcon,
	SparklesIcon,
	SunIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
	SidebarTrigger,
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
	const { resolvedTheme, setTheme } = useTheme();

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<div className="flex items-center justify-between px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
					<div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
						<Image src="/img/logo-light-mode.svg" alt="" width={26} height={20} className="dark:hidden" />
						<Image src="/img/logo-dark-mode.svg" alt="" width={26} height={20} className="hidden dark:block" />
						<div className="flex flex-col">
							<span className="text-sm leading-none font-semibold">next-safe-action</span>
							<span className="text-muted-foreground text-xs">playground</span>
						</div>
					</div>
					<SidebarTrigger />
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
										<SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
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
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild tooltip="GitHub">
							<a href="https://github.com/next-safe-action/next-safe-action" target="_blank" rel="noopener noreferrer">
								<GithubIcon className="size-4" />
								<span>GitHub</span>
							</a>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton
							tooltip="Toggle theme"
							onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
						>
							<SunIcon className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
							<MoonIcon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
							<span>Toggle theme</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
