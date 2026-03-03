import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { Inter, Google_Sans_Code } from "next/font/google";
import type { ReactNode } from "react";
import "./global.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const googleSansCode = Google_Sans_Code({
	subsets: ["latin"],
	variable: "--font-google-sans-code",
});

export const metadata: Metadata = {
	title: {
		template: "%s | next-safe-action",
		default: "next-safe-action",
	},
	description: "Type safe Server Actions in your Next.js project.",
	metadataBase: new URL("https://next-safe-action.dev"),
	openGraph: {
		title: "next-safe-action",
		description: "Type safe Server Actions in your Next.js project.",
		siteName: "next-safe-action",
		images: ["/img/social-card.png"],
	},
	icons: {
		icon: [
			{ url: "/img/favicon-32x32.png", sizes: "32x32", type: "image/png" },
			{ url: "/img/favicon-16x16.png", sizes: "16x16", type: "image/png" },
		],
		shortcut: "/img/favicon.ico",
	},
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" className={`${inter.variable} ${googleSansCode.variable}`} suppressHydrationWarning>
			<head>
				<script defer data-domain="next-safe-action.dev" src="https://plausible.theedoran.xyz/js/script.js" />
			</head>
			<body className="flex min-h-screen flex-col">
				<RootProvider>{children}</RootProvider>
			</body>
		</html>
	);
}
