import type { Metadata } from "next";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
	title: "next-safe-action playground",
	description: "Interactive playground for the next-safe-action library",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="antialiased">
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
					<SidebarProvider>
						<AppSidebar />
						<SidebarInset>
							<div className="flex h-14 shrink-0 items-center px-4 md:hidden">
								<SidebarTrigger />
							</div>
							<main className="flex-1 p-6">
								<Suspense>{children}</Suspense>
							</main>
						</SidebarInset>
					</SidebarProvider>
					<Toaster />
				</ThemeProvider>
			</body>
		</html>
	);
}
