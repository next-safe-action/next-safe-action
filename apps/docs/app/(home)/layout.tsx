import { HomeLayout } from "fumadocs-ui/layouts/home";
import { Bricolage_Grotesque, Cascadia_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { baseLayoutOptions } from "@/lib/shared-layout";

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<div>
			<HomeLayout {...baseLayoutOptions} nav={{ ...baseLayoutOptions.nav, transparentMode: "top" }}>
				{children}
			</HomeLayout>
		</div>
	);
}
