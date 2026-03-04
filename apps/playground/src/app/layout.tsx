import type { Metadata } from "next";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
	title: "next-safe-action | Playground",
	description: "Interactive playground for the next-safe-action library",
	icons: {
		icon: [
			{ url: "/img/favicon-32x32.png", sizes: "32x32", type: "image/png" },
			{ url: "/img/favicon-16x16.png", sizes: "16x16", type: "image/png" },
		],
		shortcut: "/img/favicon.ico",
	},
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
