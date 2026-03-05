"use client";

import { motion } from "motion/react";
import Image from "next/image";
import type { ReactNode } from "react";

interface Testimonial {
	tweetUrl: string;
	authorName: string;
	authorHandle: string;
	date: string;
	text: string;
}

const testimonials: Testimonial[] = [
	{
		tweetUrl: "https://x.com/pontusab/status/1812900765444546823",
		authorName: "Pontus Abrahamsson",
		authorHandle: "pontusab",
		date: "Jul 15, 2024",
		text: "If you're using @nextjs server actions, I highly recommend next-safe-action library from @TheEdoRan. In this example, we have: @supabase client in context, Auth middleware, Analytics middleware to OpenPanel, Support for optimistic updates",
	},
	{
		tweetUrl: "https://x.com/yesdavidgray/status/1864328225158996141",
		authorName: "Dave Gray",
		authorHandle: "yesdavidgray",
		date: "Dec 4, 2024",
		text: "My Next.js 15 Project series rolls on with Chapter 8! In this video, I show how next-safe-action (@TheEdoRan) and Sentry (@getsentry) are the perfect combo for server actions",
	},
	{
		tweetUrl: "https://x.com/Lermatroid/status/1836605056650478074",
		authorName: "Liam Murray",
		authorHandle: "Lermatroid",
		date: "Sep 19, 2024",
		text: 'This is my monthly "try next-safe-action" post. It will blow your mind how easy it is to setup a e2e typesafe api in next.',
	},
	{
		tweetUrl: "https://x.com/Kingsley_codes/status/1718282007510143183",
		authorName: "Kingsley O.",
		authorHandle: "Kingsley_codes",
		date: "Oct 28, 2023",
		text: "If you aren't using next-safe-actions by @TheEdoRan for your Next 14 app, what are you waiting for? The DX is marvelous. An even better package than zact and @t3dotgg recommends it too so you know it's good!",
	},
	{
		tweetUrl: "https://x.com/nikelsnik/status/1833845745998250393",
		authorName: "Nik Elsnik",
		authorHandle: "nikelsnik",
		date: "Sep 11, 2024",
		text: "My go-to method for handling forms in @nextjs: react-hook-form for form handling, zod for validation, shadcn/ui for UI components, next-safe-action for server actions, sonner for toast messages",
	},
	{
		tweetUrl: "https://x.com/zaphodias/status/1654158096048979973",
		authorName: "Antonio",
		authorHandle: "zaphodias",
		date: "May 4, 2023",
		text: "step 1: upgrade to next 13.4; step 2: understand actions; step 3: use @TheEdoRan's lib",
	},
	{
		tweetUrl: "https://x.com/rclmenezes/status/1654111420047409153",
		authorName: "rigo",
		authorHandle: "rclmenezes",
		date: "May 4, 2023",
		text: "I predict that next-safe-action is going to get a loooooot of stars in a few hours :) Props @TheEdoRan",
	},
	{
		tweetUrl: "https://x.com/ErfanEbrahimnia/status/1699816975009013935",
		authorName: "Erfan Ebrahimnia",
		authorHandle: "ErfanEbrahimnia",
		date: "Sep 7, 2023",
		text: "Using next-safe-action by @TheEdoRan in a project right now and really like it. It handles input-validation and errors when using Server Actions",
	},
	{
		tweetUrl: "https://x.com/1weiho/status/1870423791979167799",
		authorName: "Yiwei Ho",
		authorHandle: "1weiho",
		date: "Dec 21, 2024",
		text: "Recently, my favorite package to use with Next.js is next-safe-action, which allows you to wrap all server actions with a custom action client that can define effects similar to middleware for server actions using a pipeline pattern, such as authentication and rate limiting.",
	},
	{
		tweetUrl: "https://x.com/pontusab/status/1823999228122972614",
		authorName: "Pontus Abrahamsson",
		authorHandle: "pontusab",
		date: "Aug 15, 2024",
		text: "The best way to handle forms in @nextjs, from client to database: Shadcn for UI components, React Hook Form for form handling, zod for validation, next-safe-action for server actions",
	},
	{
		tweetUrl: "https://x.com/Xexr/status/1674154036788879360",
		authorName: "Xexr",
		authorHandle: "Xexr",
		date: "Jun 28, 2023",
		text: "@t3dotgg I saw you mention next-safe-action on your live stream. I wanted to throw my hat in the ring and give it a shout out. It's honestly great, @TheEdoRan has done a fantastic job and it deserves way more attention.",
	},
	{
		tweetUrl: "https://x.com/CasterKno/status/1804780098320552304",
		authorName: "Caster",
		authorHandle: "CasterKno",
		date: "Jun 23, 2024",
		text: "I recently came across a library called next-safe-action, which I'm impressed with. I'll definitely be using it in my next project.",
	},
	{
		tweetUrl: "https://x.com/muratsutunc/status/1868235838724923767",
		authorName: "Murat Sutunc",
		authorHandle: "muratsutunc",
		date: "Dec 15, 2024",
		text: "next-safe-action is highly recommended",
	},
	{
		tweetUrl: "https://x.com/Rajdeep__ds/status/1874329087302668652",
		authorName: "Rajdeep",
		authorHandle: "Rajdeep__ds",
		date: "Jan 1, 2025",
		text: "Just tried @TheEdoRan's next-safe-action with @nextjs 15 Server Actions—it's a game-changer! 🚀 Type-safe server actions + seamless DX = 🔥 Highly recommend checking it out! 🤩",
	},
	{
		tweetUrl: "https://x.com/JustinLicata/status/2009255152092418215",
		authorName: "Justin",
		authorHandle: "JustinLicata",
		date: "Jan 8, 2026",
		text: "Using next-safe-action for Next.js server actions has been a game changer for us. It makes type safety solid, error handling clearer and everything just feels more consistent and reliable for an improved DX.",
	},
	{
		tweetUrl: "https://x.com/DmytroKrasun/status/2003796650507321488",
		authorName: "Dmytro Krasun",
		authorHandle: "DmytroKrasun",
		date: "Dec 24, 2025",
		text: "You don't need tRPC with Next.js. You need type safe Server Actions 👉 https://next-safe-action.dev",
	},
	{
		tweetUrl: "https://x.com/guscsales/status/2003432534085173381",
		authorName: "Gus",
		authorHandle: "guscsales",
		date: "Dec 23, 2025",
		text: "next-safe-action handles the messy parts so you don't have to. Simple, safe, and actually pleasant to use.",
	},
];

function highlightMentions(text: string): ReactNode[] {
	const parts = text.split(/(@\w+)/g);
	return parts.map((part, i) => {
		if (part.startsWith("@")) {
			return (
				<span key={i} className="text-amber-accent-light font-medium">
					{part}
				</span>
			);
		}
		return part;
	});
}

function XIcon() {
	return (
		<svg viewBox="0 0 24 24" className="text-fd-muted-foreground h-4 w-4 shrink-0" fill="currentColor">
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
		</svg>
	);
}

function TweetCard({ testimonial }: { testimonial: Testimonial }) {
	return (
		<a
			href={testimonial.tweetUrl}
			target="_blank"
			rel="noopener noreferrer"
			className="border-fd-border bg-fd-card hover:border-amber-border flex w-[320px] shrink-0 flex-col rounded-xl border p-4 transition-colors sm:w-[360px]"
		>
			<div className="flex items-start justify-between gap-2">
				<div className="flex items-center gap-3">
					<Image
						src={`/img/x/${testimonial.authorHandle}.jpg`}
						alt={testimonial.authorName}
						width={40}
						height={40}
						className="rounded-full"
					/>
					<div className="min-w-0">
						<p className="text-fd-foreground truncate text-sm font-semibold">{testimonial.authorName}</p>
						<p className="text-fd-muted-foreground text-xs">@{testimonial.authorHandle}</p>
					</div>
				</div>
				<XIcon />
			</div>
			<p className="text-fd-foreground/90 mt-3 flex-1 text-sm leading-relaxed">{highlightMentions(testimonial.text)}</p>
			<p className="text-fd-muted-foreground mt-3 text-xs">{testimonial.date}</p>
		</a>
	);
}

function MarqueeRow({ items, direction }: { items: Testimonial[]; direction: "left" | "right" }) {
	const duplicated = [...items, ...items];

	return (
		<div
			className="overflow-hidden"
			style={{
				maskImage: "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
				WebkitMaskImage: "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
			}}
		>
			<div
				className={`flex gap-4 ${direction === "left" ? "animate-marquee-left" : "animate-marquee-right"}`}
				style={{ width: "max-content" }}
			>
				{duplicated.map((testimonial, i) => (
					<TweetCard key={`${testimonial.authorHandle}-${i}`} testimonial={testimonial} />
				))}
			</div>
		</div>
	);
}

const row1 = testimonials.slice(0, 9);
const row2 = testimonials.slice(9);

export function Testimonials() {
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
					What developers are saying
				</motion.h2>
				<motion.p
					className="text-fd-muted-foreground mx-auto mt-4 max-w-2xl text-center text-lg"
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.5, delay: 0.1 }}
				>
					Join thousands of developers who are already using next-safe-action in their projects
				</motion.p>
			</div>

			<div className="mt-12 space-y-4">
				<MarqueeRow items={row1} direction="left" />
				<MarqueeRow items={row2} direction="right" />
			</div>
		</section>
	);
}
