import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export const baseLayoutOptions: BaseLayoutProps = {
	githubUrl: "https://github.com/next-safe-action/next-safe-action",
	nav: {
		title: (
			<>
				<img src="/img/logo-light-mode.svg" alt="" width={26} height={20} className="dark:hidden" />
				<img src="/img/logo-dark-mode.svg" alt="" width={26} height={20} className="hidden dark:block" />
				next-safe-action
			</>
		),
		url: "/",
	},
};
