import { fetchGitHubSponsors, fetchGitHubStars } from "@/lib/github";
import { CodeShowcase } from "./_components/code-showcase";
import { Features } from "./_components/features";
import { FooterCta } from "./_components/footer-cta";
import { Hero } from "./_components/hero";
import { Sponsors } from "./_components/sponsors";

export default async function HomePage() {
	const [stars, sponsors] = await Promise.all([fetchGitHubStars(), fetchGitHubSponsors()]);

	return (
		<>
			<Hero stars={stars} />
			<Features />
			<CodeShowcase />
			<Sponsors data={sponsors} />
			<FooterCta />
		</>
	);
}
