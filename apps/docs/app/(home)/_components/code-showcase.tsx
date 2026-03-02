"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

interface CodeTab {
	id: string;
	label: string;
	fileName: string;
	lines: { indent: number; parts: { text: string; color: string }[] }[];
}

const tabs: CodeTab[] = [
	{
		id: "client",
		label: "Create Client",
		fileName: "safe-action.ts",
		lines: [
			{
				indent: 0,
				parts: [
					{ text: "import", color: "text-purple-400" },
					{ text: " { createSafeActionClient }", color: "text-fd-foreground" },
					{ text: " from ", color: "text-purple-400" },
					{ text: '"next-safe-action"', color: "text-green-400" },
					{ text: ";", color: "text-fd-muted-foreground" },
				],
			},
			{ indent: 0, parts: [] },
			{
				indent: 0,
				parts: [
					{ text: "export const", color: "text-purple-400" },
					{ text: " actionClient", color: "text-amber-accent-light" },
					{ text: " = ", color: "text-fd-muted-foreground" },
					{ text: "createSafeActionClient", color: "text-blue-400" },
					{ text: "({", color: "text-fd-muted-foreground" },
				],
			},
			{
				indent: 1,
				parts: [
					{ text: "handleServerError", color: "text-fd-foreground" },
					{ text: "(e) {", color: "text-fd-muted-foreground" },
				],
			},
			{
				indent: 2,
				parts: [
					{ text: "console", color: "text-fd-foreground" },
					{ text: ".", color: "text-fd-muted-foreground" },
					{ text: "error", color: "text-blue-400" },
					{ text: "(", color: "text-fd-muted-foreground" },
					{ text: '"Action error:"', color: "text-green-400" },
					{ text: ", e.", color: "text-fd-muted-foreground" },
					{ text: "message", color: "text-fd-foreground" },
					{ text: ");", color: "text-fd-muted-foreground" },
				],
			},
			{
				indent: 2,
				parts: [
					{ text: "return", color: "text-purple-400" },
					{ text: " ", color: "text-fd-muted-foreground" },
					{ text: '"Something went wrong."', color: "text-green-400" },
					{ text: ";", color: "text-fd-muted-foreground" },
				],
			},
			{
				indent: 1,
				parts: [{ text: "},", color: "text-fd-muted-foreground" }],
			},
			{
				indent: 0,
				parts: [{ text: "});", color: "text-fd-muted-foreground" }],
			},
		],
	},
	{
		id: "action",
		label: "Define Action",
		fileName: "greet-action.ts",
		lines: [
			{
				indent: 0,
				parts: [
					{ text: '"use server"', color: "text-green-400" },
					{ text: ";", color: "text-fd-muted-foreground" },
				],
			},
			{ indent: 0, parts: [] },
			{
				indent: 0,
				parts: [
					{ text: "import", color: "text-purple-400" },
					{ text: " { z }", color: "text-fd-foreground" },
					{ text: " from ", color: "text-purple-400" },
					{ text: '"zod"', color: "text-green-400" },
					{ text: ";", color: "text-fd-muted-foreground" },
				],
			},
			{
				indent: 0,
				parts: [
					{ text: "import", color: "text-purple-400" },
					{ text: " { actionClient }", color: "text-fd-foreground" },
					{ text: " from ", color: "text-purple-400" },
					{ text: '"./safe-action"', color: "text-green-400" },
					{ text: ";", color: "text-fd-muted-foreground" },
				],
			},
			{ indent: 0, parts: [] },
			{
				indent: 0,
				parts: [
					{ text: "export const", color: "text-purple-400" },
					{ text: " greetAction", color: "text-amber-accent-light" },
					{ text: " = ", color: "text-fd-muted-foreground" },
					{ text: "actionClient", color: "text-blue-400" },
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
			{
				indent: 1,
				parts: [{ text: "}))", color: "text-fd-muted-foreground" }],
			},
			{
				indent: 1,
				parts: [
					{ text: ".", color: "text-fd-muted-foreground" },
					{ text: "action", color: "text-blue-400" },
					{ text: "(", color: "text-fd-muted-foreground" },
					{ text: "async", color: "text-purple-400" },
					{ text: " ({ parsedInput }) ", color: "text-fd-muted-foreground" },
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
					{ text: "${parsedInput.name}", color: "text-amber-accent-light" },
					{ text: "!`", color: "text-green-400" },
					{ text: " };", color: "text-fd-muted-foreground" },
				],
			},
			{
				indent: 1,
				parts: [{ text: "});", color: "text-fd-muted-foreground" }],
			},
		],
	},
	{
		id: "hooks",
		label: "Use with Hooks",
		fileName: "greet-form.tsx",
		lines: [
			{
				indent: 0,
				parts: [
					{ text: '"use client"', color: "text-green-400" },
					{ text: ";", color: "text-fd-muted-foreground" },
				],
			},
			{ indent: 0, parts: [] },
			{
				indent: 0,
				parts: [
					{ text: "import", color: "text-purple-400" },
					{ text: " { useAction }", color: "text-fd-foreground" },
					{ text: " from ", color: "text-purple-400" },
					{ text: '"next-safe-action/hooks"', color: "text-green-400" },
					{ text: ";", color: "text-fd-muted-foreground" },
				],
			},
			{
				indent: 0,
				parts: [
					{ text: "import", color: "text-purple-400" },
					{ text: " { greetAction }", color: "text-fd-foreground" },
					{ text: " from ", color: "text-purple-400" },
					{ text: '"./greet-action"', color: "text-green-400" },
					{ text: ";", color: "text-fd-muted-foreground" },
				],
			},
			{ indent: 0, parts: [] },
			{
				indent: 0,
				parts: [
					{ text: "const", color: "text-purple-400" },
					{ text: " { ", color: "text-fd-muted-foreground" },
					{ text: "execute, result, isExecuting", color: "text-amber-accent-light" },
					{ text: " } = ", color: "text-fd-muted-foreground" },
					{ text: "useAction", color: "text-blue-400" },
					{ text: "(", color: "text-fd-muted-foreground" },
					{ text: "greetAction", color: "text-fd-foreground" },
					{ text: ");", color: "text-fd-muted-foreground" },
				],
			},
			{ indent: 0, parts: [] },
			{
				indent: 0,
				parts: [
					{ text: "// ", color: "text-fd-muted-foreground" },
					{ text: "result.data?.greeting", color: "text-fd-muted-foreground" },
					{ text: " is fully typed!", color: "text-fd-muted-foreground" },
				],
			},
			{
				indent: 0,
				parts: [
					{ text: "execute", color: "text-blue-400" },
					{ text: "({ ", color: "text-fd-muted-foreground" },
					{ text: "name", color: "text-fd-foreground" },
					{ text: ": ", color: "text-fd-muted-foreground" },
					{ text: '"World"', color: "text-green-400" },
					{ text: " });", color: "text-fd-muted-foreground" },
				],
			},
		],
	},
];

export function CodeShowcase() {
	const [activeTab, setActiveTab] = useState("client");
	const activeCode = tabs.find((t) => t.id === activeTab)!;

	return (
		<section className="px-6 py-24">
			<div className="mx-auto max-w-4xl">
				<motion.h2
					className="font-display text-center text-3xl font-bold tracking-tight sm:text-4xl"
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.5 }}
				>
					How it works
				</motion.h2>

				{/* Tabs */}
				<div className="mt-12 flex justify-center gap-1">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className="text-fd-muted-foreground hover:text-fd-foreground relative px-4 py-2 text-sm font-medium transition-colors"
						>
							{activeTab === tab.id && (
								<motion.div
									layoutId="active-tab"
									className="bg-amber-accent absolute inset-x-0 bottom-0 h-0.5 rounded-full"
									transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
								/>
							)}
							<span className={activeTab === tab.id ? "text-amber-accent-light" : ""}>{tab.label}</span>
						</button>
					))}
				</div>

				{/* Code panel */}
				<div className="border-fd-border bg-fd-card mt-6 overflow-hidden rounded-xl border shadow-xl">
					{/* File header */}
					<div className="border-fd-border flex items-center gap-2 border-b px-4 py-3">
						<div className="bg-fd-muted-foreground/20 h-3 w-3 rounded-full" />
						<div className="bg-fd-muted-foreground/20 h-3 w-3 rounded-full" />
						<div className="bg-fd-muted-foreground/20 h-3 w-3 rounded-full" />
						<span className="text-fd-muted-foreground ml-2 text-xs">{activeCode.fileName}</span>
					</div>

					{/* Code content */}
					<div className="overflow-x-auto p-4">
						<AnimatePresence mode="wait">
							<motion.pre
								key={activeTab}
								className="font-mono-code text-sm leading-relaxed"
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
								transition={{ duration: 0.2 }}
							>
								{activeCode.lines.map((line, i) => (
									<div key={i} style={{ paddingLeft: `${line.indent * 1.5}rem` }}>
										{line.parts.length === 0
											? "\u00A0"
											: line.parts.map((part, j) => (
													<span key={j} className={part.color}>
														{part.text}
													</span>
												))}
									</div>
								))}
							</motion.pre>
						</AnimatePresence>
					</div>
				</div>
			</div>
		</section>
	);
}
