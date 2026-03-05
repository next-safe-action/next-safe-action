"use client";

import { motion } from "motion/react";
import Link from "next/link";

const codeLines = [
	{
		indent: 0,
		parts: [{ text: '"use server";', color: "text-green-400" }],
	},
	{
		indent: 0,
		parts: [{ text: "\n" }],
	},
	{
		indent: 0,
		parts: [
			{ text: "const", color: "text-purple-400" },
			{ text: " action", color: "text-amber-accent-light" },
			{ text: " = ", color: "text-fd-muted-foreground" },
			{ text: "actionClient", color: "text-blue-400" },
		],
	},
	{
		indent: 1,
		parts: [
			{ text: ".", color: "text-fd-muted-foreground" },
			{ text: "use", color: "text-blue-400" },
			{ text: "(", color: "text-fd-muted-foreground" },
			{ text: "authMiddleware", color: "text-amber-accent-light" },
			{ text: ")", color: "text-fd-muted-foreground" },
		],
	},
	{
		indent: 1,
		parts: [
			{ text: ".", color: "text-fd-muted-foreground" },
			{ text: "inputSchema", color: "text-blue-400" },
			{ text: "(", color: "text-fd-muted-foreground" },
			{ text: "z", color: "text-green-400" },
			{ text: ".", color: "text-fd-muted-foreground" },
			{ text: "object", color: "text-green-400" },
			{ text: "({", color: "text-fd-muted-foreground" },
		],
	},
	{
		indent: 2,
		parts: [
			{ text: "name", color: "text-fd-foreground" },
			{ text: ": ", color: "text-fd-muted-foreground" },
			{ text: "z", color: "text-green-400" },
			{ text: ".", color: "text-fd-muted-foreground" },
			{ text: "string", color: "text-green-400" },
			{ text: "().", color: "text-fd-muted-foreground" },
			{ text: "min", color: "text-green-400" },
			{ text: "(", color: "text-fd-muted-foreground" },
			{ text: "1", color: "text-orange-400" },
			{ text: "),", color: "text-fd-muted-foreground" },
		],
	},
	{ indent: 1, parts: [{ text: "}))", color: "text-fd-muted-foreground" }] },
	{
		indent: 1,
		parts: [
			{ text: ".", color: "text-fd-muted-foreground" },
			{ text: "action", color: "text-blue-400" },
			{ text: "(", color: "text-fd-muted-foreground" },
			{ text: "async", color: "text-purple-400" },
			{ text: " ({ ctx, parsedInput }) ", color: "text-fd-muted-foreground" },
			{ text: "=>", color: "text-purple-400" },
			{ text: " {", color: "text-fd-muted-foreground" },
		],
	},
	{
		indent: 2,
		parts: [
			{ text: "return", color: "text-purple-400" },
			{ text: " { ", color: "text-fd-muted-foreground" },
			{ text: "greeting", color: "text-fd-foreground" },
			{ text: ": ", color: "text-fd-muted-foreground" },
			{ text: "`Hello, ", color: "text-green-400" },
			{ text: "${", color: "text-amber-accent-light" },
			{ text: "parsedInput.name", color: "text-amber-accent-light" },
			{ text: "}", color: "text-amber-accent-light" },
			{ text: "!`", color: "text-green-400" },
			{ text: " };", color: "text-fd-muted-foreground" },
		],
	},
	{ indent: 1, parts: [{ text: "});", color: "text-fd-muted-foreground" }] },
];

function formatStarCount(count: number): string {
	return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(count);
}

export function Hero({ stars }: { stars: number | null }) {
	return (
		<section className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 pt-20 pb-16 sm:px-6 sm:pb-24">
			{/* Background glow */}
			<div className="bg-amber-glow pointer-events-none absolute top-1/4 left-1/2 h-[400px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl sm:h-[600px] sm:w-[800px]" />

			<div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-20">
				{/* Left: text content */}
				<div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
					<motion.h1
						className="text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl md:text-6xl"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.1 }}
					>
						Type-safe Server Actions for <span className="text-amber-accent">Next.js</span>
					</motion.h1>

					<motion.p
						className="text-fd-muted-foreground mt-6 max-w-xl sm:text-lg"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.2 }}
					>
						Type-safe, validated and middleware-powered Server Actions for Next.js. Supports any validator that
						implements the Standard Schema specification.
					</motion.p>

					<motion.div
						className="mt-8 flex flex-wrap items-center gap-4"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.3 }}
					>
						<Link
							href="/docs/getting-started"
							className="bg-amber-accent hover:bg-amber-accent-light inline-flex h-11 items-center rounded-lg px-4 font-semibold text-black transition-colors sm:px-6"
						>
							Get started
						</Link>
						<a
							href="https://github.com/TheEdoRan/next-safe-action"
							target="_blank"
							rel="noopener noreferrer"
							className="border-fd-border text-fd-foreground hover:bg-fd-accent inline-flex h-11 items-center gap-2 rounded-lg border px-4 font-semibold transition-colors sm:px-6"
						>
							GitHub
							{stars !== null && <span className="text-fd-muted-foreground">&middot; {formatStarCount(stars)}</span>}
						</a>
					</motion.div>
				</div>

				{/* Right: code preview */}
				<motion.div
					className="w-full max-w-lg flex-1 lg:max-w-none"
					initial={{ opacity: 0, x: 30 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ duration: 0.6, delay: 0.3 }}
				>
					<div className="border-fd-border bg-fd-card overflow-hidden rounded-xl border shadow-2xl">
						{/* Window chrome */}
						<div className="border-fd-border flex items-center gap-2 border-b px-4 py-3 sm:px-5 sm:py-3.5">
							<div className="bg-fd-muted-foreground/20 h-3 w-3 rounded-full" />
							<div className="bg-fd-muted-foreground/20 h-3 w-3 rounded-full" />
							<div className="bg-fd-muted-foreground/20 h-3 w-3 rounded-full" />
							<span className="text-fd-muted-foreground ml-2 text-xs">action.ts</span>
						</div>
						{/* Code */}
						<div className="overflow-x-auto px-4 py-4 sm:px-6 sm:py-5">
							<pre className="font-mono text-[0.78rem] leading-6 sm:text-[0.9rem] sm:leading-7">
								{codeLines.map((line, i) => (
									<div key={i} style={{ paddingLeft: `${line.indent * 1.5}rem` }}>
										{line.parts.map((part, j) => (
											<span key={j} className={part.color}>
												{part.text}
											</span>
										))}
									</div>
								))}
							</pre>
						</div>
					</div>
				</motion.div>
			</div>
		</section>
	);
}
