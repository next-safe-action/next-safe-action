"use client";

import {
	BoxIcon,
	CircuitBoardIcon,
	FileTextIcon,
	HomeIcon,
	LayersIcon,
	MoonIcon,
	MousePointerClickIcon,
	NavigationIcon,
	ShieldAlertIcon,
	SparklesIcon,
	SunIcon,
	WifiOffIcon,
	ZapIcon,
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

// lucide dropped brand icons in v1, so the GitHub mark is inlined here.
function GithubIcon() {
	return (
		<svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2 0-.4-.5-1.6.2-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
		</svg>
	);
}

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
			{ title: "Coordinating Mutations", href: "/coordinated-mutations", icon: SparklesIcon },
		],
	},
	{
		label: "Integrations",
		items: [
			{ title: "Form Integration", href: "/forms", icon: FileTextIcon },
			{ title: "React Hook Form", href: "/react-hook-form", icon: CircuitBoardIcon },
			{ title: "TanStack Query", href: "/tanstack-query", icon: ZapIcon },
		],
	},
	{
		label: "Framework",
		items: [
			{ title: "Navigation & Framework", href: "/navigation-framework", icon: NavigationIcon },
			{ title: "Offline Support", href: "/offline-support", icon: WifiOffIcon },
		],
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
								<GithubIcon />
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
