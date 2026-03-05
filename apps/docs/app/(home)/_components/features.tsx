"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

interface Feature {
	title: string;
	description: string;
	icon: ReactNode;
}

const features: Feature[] = [
	{
		title: "End-to-End Type Safety",
		description: "Full TypeScript inference from schema definition to React hooks. No manual type wiring needed.",
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
				/>
			</svg>
		),
	},
	{
		title: "Standard Schema support",
		description: "Standard Schema v1 support: Zod, Valibot, ArkType, Yup, and any compliant validator.",
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
				/>
			</svg>
		),
	},
	{
		title: "Chainable Middleware",
		description: "Composable .use() middleware with typed context propagation across the entire chain.",
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
				/>
			</svg>
		),
	},
	{
		title: "React Hooks",
		description: "useAction and useOptimisticAction hooks with rich status tracking and callbacks.",
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
				/>
			</svg>
		),
	},
	{
		title: "Smart Error Handling",
		description: "Validation, server, and Next.js navigation errors handled gracefully with typed results.",
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
				/>
			</svg>
		),
	},
	{
		title: "Optimistic Updates",
		description: "Built-in optimistic UI support with automatic rollback on server action failure.",
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
				/>
			</svg>
		),
	},
];

const containerVariants = {
	hidden: {},
	visible: {
		transition: {
			staggerChildren: 0.1,
		},
	},
};

const cardVariants = {
	hidden: { opacity: 0, y: 24 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.5 },
	},
};

export function Features() {
	return (
		<section className="px-6 py-24">
			<div className="mx-auto max-w-6xl">
				<motion.h2
					className="text-center text-3xl font-bold tracking-tight sm:text-4xl"
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.5 }}
				>
					Everything you need for safe server actions
				</motion.h2>

				<motion.div
					className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
					variants={containerVariants}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, margin: "-100px" }}
				>
					{features.map((feature) => (
						<motion.div
							key={feature.title}
							variants={cardVariants}
							className="group border-fd-border bg-fd-card hover:border-amber-border hover:bg-amber-glow rounded-xl border p-6 transition-colors"
						>
							<div className="bg-amber-glow text-amber-accent flex h-10 w-10 items-center justify-center rounded-lg">
								{feature.icon}
							</div>
							<h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
							<p className="text-fd-muted-foreground mt-2 text-sm leading-relaxed">{feature.description}</p>
						</motion.div>
					))}
				</motion.div>
			</div>
		</section>
	);
}
