"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const installCommands = {
	npm: "npm i next-safe-action",
	pnpm: "pnpm add next-safe-action",
	yarn: "yarn add next-safe-action",
} as const;

type PackageManager = keyof typeof installCommands;

const packageManagerOptions = [
	{ id: "npm", label: "npm" },
	{ id: "pnpm", label: "pnpm" },
	{ id: "yarn", label: "yarn" },
] as const satisfies readonly { id: PackageManager; label: string }[];

export function FooterCta() {
	const [copied, setCopied] = useState(false);
	const [selectedManager, setSelectedManager] = useState<PackageManager>("npm");
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const installCmd = installCommands[selectedManager];

	useEffect(() => {
		if (!isMenuOpen) {
			return;
		}

		function handlePointerDown(event: MouseEvent) {
			if (!menuRef.current?.contains(event.target as Node)) {
				setIsMenuOpen(false);
			}
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setIsMenuOpen(false);
			}
		}

		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isMenuOpen]);

	useEffect(() => {
		return () => {
			if (copyTimeoutRef.current !== null) {
				clearTimeout(copyTimeoutRef.current);
			}
		};
	}, []);

	function handleCopy(manager: PackageManager) {
		const command = installCommands[manager];

		setSelectedManager(manager);
		setIsMenuOpen(false);

		void navigator.clipboard.writeText(command).then(() => {
			setCopied(true);

			if (copyTimeoutRef.current !== null) {
				clearTimeout(copyTimeoutRef.current);
			}

			copyTimeoutRef.current = setTimeout(() => {
				setCopied(false);
			}, 2000);
		});
	}

	return (
		<section className="px-6 py-24">
			<motion.div
				className="mx-auto max-w-2xl text-center"
				initial={{ opacity: 0, y: 20 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true, margin: "-100px" }}
				transition={{ duration: 0.5 }}
			>
				<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Get started in seconds</h2>

				{/* Install command */}
				<div
					ref={menuRef}
					className="border-fd-border bg-fd-card relative mt-8 inline-flex items-center gap-3 rounded-lg border px-5 py-3"
				>
					<code className="text-fd-muted-foreground font-mono text-sm">
						<span className="text-amber-accent">$</span> {installCmd}
					</code>
					<button
						onClick={() => setIsMenuOpen((open) => !open)}
						className="text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground rounded-md p-1.5 transition-colors"
						aria-label="Choose package manager and copy install command"
						aria-expanded={isMenuOpen}
						aria-haspopup="menu"
					>
						{copied ? (
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth={2}
								className="h-4 w-4 text-green-400"
							>
								<path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
							</svg>
						) : (
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
								/>
							</svg>
						)}
					</button>

					<AnimatePresence>
						{isMenuOpen ? (
							<motion.div
								initial={{ opacity: 0, y: -8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
								transition={{ duration: 0.16 }}
								role="menu"
								aria-label="Choose a package manager"
								className="border-fd-border bg-fd-card absolute top-[calc(100%+0.75rem)] right-0 z-10 min-w-48 rounded-xl border p-2 text-left shadow-2xl"
							>
								{packageManagerOptions.map((option) => {
									const isActive = option.id === selectedManager;

									return (
										<button
											key={option.id}
											type="button"
											role="menuitemradio"
											aria-checked={isActive}
											onClick={() => handleCopy(option.id)}
											className="hover:bg-fd-accent flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors"
										>
											<span className={isActive ? "text-amber-accent-light font-medium" : "text-fd-foreground"}>
												{option.label}
											</span>
											<span className="text-fd-muted-foreground font-mono text-xs">
												{installCommands[option.id].split(" next-safe-action")[0]}
											</span>
										</button>
									);
								})}
							</motion.div>
						) : null}
					</AnimatePresence>
				</div>

				{/* Links */}
				<div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm">
					<Link
						href="/docs/getting-started"
						className="text-amber-accent hover:text-amber-accent-light transition-colors"
					>
						Documentation
					</Link>
					<a
						href="https://github.com/next-safe-action/next-safe-action"
						target="_blank"
						rel="noopener noreferrer"
						className="text-fd-muted-foreground hover:text-fd-foreground transition-colors"
					>
						GitHub
					</a>
					<a
						href="https://www.npmjs.com/package/next-safe-action"
						target="_blank"
						rel="noopener noreferrer"
						className="text-fd-muted-foreground hover:text-fd-foreground transition-colors"
					>
						npm
					</a>
				</div>
			</motion.div>
		</section>
	);
}
