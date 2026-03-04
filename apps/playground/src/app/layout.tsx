import type { Metadata } from "next";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
	title: "next-safe-action playground",
	description: "Interactive playground for the next-safe-action library",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body className="antialiased">
				<SidebarProvider>
					<AppSidebar />
					<SidebarInset>
						<header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
							<SidebarTrigger className="-ml-1" />
							<Separator orientation="vertical" className="mr-2 h-4" />
							<span className="text-muted-foreground text-sm font-medium">next-safe-action playground</span>
						</header>
						<main className="flex-1 p-6">{children}</main>
					</SidebarInset>
				</SidebarProvider>
				<Toaster />
			</body>
		</html>
	);
}
