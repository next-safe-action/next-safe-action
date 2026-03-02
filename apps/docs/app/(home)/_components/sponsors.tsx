"use client";

import { motion } from "motion/react";
import Image from "next/image";
import type { Sponsor, SponsorsData } from "@/lib/github";

const containerVariants = {
	hidden: {},
	visible: {
		transition: {
			staggerChildren: 0.04,
		},
	},
};

const itemVariants = {
	hidden: { opacity: 0, y: 12 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.35 },
	},
};

function getAvatarSize(amount: number) {
	if (amount >= 250) return 88;
	if (amount >= 100) return 76;
	if (amount >= 25) return 64;
	if (amount >= 10) return 54;
	if (amount > 0) return 46;
	return 42;
}

function buildCurrentSponsors(data: SponsorsData | null) {
	return (data?.sponsors ?? [])
		.filter((sponsor) => sponsor.isActive)
		.sort((a, b) => b.monthlyAmount - a.monthlyAmount || a.login.localeCompare(b.login));
}

function buildPastSponsors(data: SponsorsData | null) {
	return (data?.sponsors ?? []).filter((sponsor) => !sponsor.isActive).sort((a, b) => a.login.localeCompare(b.login));
}

function formatSponsorAmount(sponsor: Sponsor) {
	if (sponsor.monthlyAmount > 0) {
		return `$${sponsor.monthlyAmount}/month`;
	}

	return sponsor.isActive ? "Active sponsor" : "Past sponsor";
}

function SponsorLink({ sponsor, size, muted = false }: { sponsor: Sponsor; size: number; muted?: boolean }) {
	const label = sponsor.name ?? sponsor.login;
	const tooltipAmount = formatSponsorAmount(sponsor);
	const sponsorUrl = `https://github.com/${sponsor.login}`;

	return (
		<motion.div variants={itemVariants} className="relative">
			<a
				href={sponsorUrl}
				target="_blank"
				rel="noopener noreferrer"
				aria-label={label}
				className={[
					"group inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-accent focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background",
					muted ? "opacity-60 grayscale-[0.25] hover:opacity-100 hover:grayscale-0" : "",
				].join(" ")}
			>
				<Image
					src={sponsor.avatarUrl}
					alt={label}
					width={size}
					height={size}
					sizes={`${size}px`}
					className={[
						"rounded-full border transition-all duration-300 group-hover:-translate-y-0.5",
						muted
							? "border-fd-border/70 shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
							: "border-amber-border/70 shadow-[0_12px_30px_rgba(245,158,11,0.14)] group-hover:border-amber-accent/60",
						].join(" ")}
				/>
				<div className="pointer-events-none absolute bottom-[calc(100%+0.75rem)] left-1/2 z-10 w-max min-w-36 max-w-52 -translate-x-1/2 translate-y-1 rounded-xl border border-amber-border/60 bg-fd-card/95 px-3 py-2 text-center opacity-0 shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur-sm transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
					<p className="text-fd-foreground text-sm font-semibold">@{sponsor.login}</p>
					<p className="text-fd-muted-foreground mt-1 text-xs">{tooltipAmount}</p>
					<div className="border-r-amber-border/60 border-b-amber-border/60 bg-fd-card/95 absolute top-full left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-r border-b" />
				</div>
			</a>
		</motion.div>
	);
}

export function Sponsors({ data }: { data: SponsorsData | null }) {
	const currentSponsors = buildCurrentSponsors(data);
	const pastSponsors = buildPastSponsors(data);
	const hasSponsorContent = currentSponsors.length > 0 || pastSponsors.length > 0;

	return (
		<section className="relative overflow-hidden px-6 py-24">
			<div className="bg-amber-glow absolute top-20 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full blur-3xl" />
			<div className="via-amber-border absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent to-transparent" />

			<div className="relative mx-auto max-w-5xl">
				<motion.div
					className="mx-auto max-w-2xl text-center"
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.5 }}
				>
					<h2 className="text-amber-accent-light text-sm font-semibold tracking-[0.35em] uppercase">Our sponsors</h2>
					<p className="text-fd-muted-foreground mt-4 text-lg">
						These amazing people and companies help keep next-safe-action running! ❤️
					</p>
				</motion.div>

				{hasSponsorContent && (
					<div className="mt-14 space-y-10">
						{currentSponsors.length > 0 && (
							<motion.div
								className="flex flex-wrap items-center justify-center gap-3 sm:gap-4"
								variants={containerVariants}
								initial="hidden"
								whileInView="visible"
								viewport={{ once: true, margin: "-80px" }}
							>
								{currentSponsors.map((sponsor) => (
									<SponsorLink key={sponsor.login} sponsor={sponsor} size={getAvatarSize(sponsor.monthlyAmount)} />
								))}
							</motion.div>
						)}

						{pastSponsors.length > 0 && (
							<motion.div
								className="border-fd-border/80 border-t pt-6"
								initial={{ opacity: 0, y: 16 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true, margin: "-60px" }}
								transition={{ duration: 0.45 }}
							>
								<div className="space-y-2 text-center">
									<p className="text-fd-muted-foreground text-sm font-semibold tracking-[0.3em] uppercase">
										Past sponsors
									</p>
									<p className="text-fd-muted-foreground text-sm">Previous supporters and completed sponsorships.</p>
								</div>

								<motion.div
									className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:gap-4"
									variants={containerVariants}
									initial="hidden"
									whileInView="visible"
									viewport={{ once: true, margin: "-60px" }}
								>
									{pastSponsors.map((sponsor) => (
										<SponsorLink key={sponsor.login} sponsor={sponsor} size={42} muted />
									))}
								</motion.div>
							</motion.div>
						)}
					</div>
				)}

				<motion.div
					className="mt-12 text-center"
					initial={{ opacity: 0, y: 12 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-50px" }}
					transition={{ duration: 0.4, delay: 0.1 }}
				>
					<a
						href="https://github.com/sponsors/TheEdoRan"
						target="_blank"
						rel="noopener noreferrer"
						className="border-amber-border text-amber-accent-light hover:bg-amber-glow inline-flex h-11 items-center rounded-lg border px-6 font-semibold transition-colors"
					>
						Become a sponsor
					</a>
				</motion.div>
			</div>
		</section>
	);
}
