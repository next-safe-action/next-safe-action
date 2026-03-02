interface Sponsor {
	login: string;
	name: string | null;
	avatarUrl: string;
	entityType: "User" | "Organization";
	monthlyAmount: number;
	tierName: string | null;
	isActive: boolean;
}

interface SponsorsData {
	tiers: { name: string; monthlyPriceInDollars: number; isOneTime: boolean }[];
	sponsors: Sponsor[];
}

export type { Sponsor, SponsorsData };

export async function fetchGitHubStars(): Promise<number | null> {
	try {
		const res = await fetch("https://api.github.com/repos/TheEdoRan/next-safe-action", {
			next: { revalidate: 3600 },
		});

		if (!res.ok) return null;

		const data = (await res.json()) as { stargazers_count: number };
		return data.stargazers_count;
	} catch {
		return null;
	}
}

export async function fetchGitHubSponsors(): Promise<SponsorsData | null> {
	const token = process.env.SPONSORS_GITHUB_TOKEN;
	if (!token) return null;

	const query = `
		query {
			user(login: "TheEdoRan") {
				sponsorsListing {
					tiers(first: 20) {
						nodes {
							name
							monthlyPriceInDollars
							isOneTime
							isCustomAmount
						}
					}
				}
				sponsorshipsAsMaintainer(first: 100, activeOnly: false, includePrivate: false) {
					nodes {
						sponsorEntity {
							__typename
							... on User { login name avatarUrl }
							... on Organization { login name avatarUrl }
						}
						tier { monthlyPriceInDollars name }
					}
				}
			}
		}
	`;

	try {
		const res = await fetch("https://api.github.com/graphql", {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query }),
			next: { revalidate: 86400 },
		});

		if (!res.ok) {
			const errorText = await res.text();
			console.error(`[github] sponsors API returned ${res.status}: ${errorText}`);
			return null;
		}

		const json = (await res.json()) as {
			errors?: { message: string; type: string }[];
			data?: {
				user: {
					sponsorsListing:
						| {
								tiers: {
									nodes: {
										name: string;
										monthlyPriceInDollars: number;
										isOneTime: boolean;
										isCustomAmount: boolean;
									}[];
								};
							}
						| null;
					sponsorshipsAsMaintainer: {
						nodes: {
							sponsorEntity:
								| {
										__typename: "User" | "Organization";
										login: string;
										name: string | null;
										avatarUrl: string;
									}
								| null;
							tier: { monthlyPriceInDollars: number; name: string } | null;
						}[];
					};
				};
			};
		};

		if (json.errors) {
			console.error("[github] GraphQL errors:", json.errors.map((e) => e.message).join(", "));
		}

		if (!json.data) {
			return null;
		}

		const user = json.data.user;

		const tiers = (user.sponsorsListing?.tiers.nodes ?? [])
			.filter((t) => !t.isCustomAmount)
			.map((t) => ({
				name: t.name,
				monthlyPriceInDollars: t.monthlyPriceInDollars,
				isOneTime: t.isOneTime,
			}));

		// Current sponsors keep a tier-derived amount. Ended sponsors lose that tier, so
		// they normalize to amount 0 with the current query shape.
		const sponsors: Sponsor[] = user.sponsorshipsAsMaintainer.nodes
			.filter((node) => node.sponsorEntity?.login)
			.map((node) => ({
				login: node.sponsorEntity!.login,
				name: node.sponsorEntity!.name,
				avatarUrl: node.sponsorEntity!.avatarUrl,
				entityType: node.sponsorEntity!.__typename,
				monthlyAmount: node.tier?.monthlyPriceInDollars ?? 0,
				tierName: node.tier?.name ?? null,
				isActive: node.tier !== null,
			}));

		return { tiers, sponsors };
	} catch (e) {
		console.error("[github] failed to fetch sponsors:", e);
		return null;
	}
}
