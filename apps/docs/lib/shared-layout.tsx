import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";

export const baseLayoutOptions: BaseLayoutProps = {
	githubUrl: "https://github.com/TheEdoRan/next-safe-action",
	nav: {
		title: (
			<>
				<Image src="/img/logo-light-mode.svg" alt="" width={26} height={20} className="dark:hidden" />
				<Image src="/img/logo-dark-mode.svg" alt="" width={26} height={20} className="hidden dark:block" />
				next-safe-action
			</>
		),
		url: "/",
	},
};
