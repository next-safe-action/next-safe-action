import { HomeLayout } from "fumadocs-ui/layouts/home";
import { Bricolage_Grotesque } from "next/font/google";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { baseLayoutOptions } from "@/lib/shared-layout";

const bricolageGrotesque = Bricolage_Grotesque({
	subsets: ["latin"],
	variable: "--font-bricolage-grotesque",
});

const hack = localFont({
	src: [
		{ path: "../fonts/hack-regular.woff2", weight: "400", style: "normal" },
		{ path: "../fonts/hack-bold.woff2", weight: "700", style: "normal" },
	],
	variable: "--font-hack",
	display: "swap",
});

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<div className={`${bricolageGrotesque.variable} ${hack.variable}`}>
			<HomeLayout {...baseLayoutOptions} nav={{ ...baseLayoutOptions.nav, transparentMode: "top" }}>
				{children}
			</HomeLayout>
		</div>
	);
}
