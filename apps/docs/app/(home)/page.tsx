import { fetchGitHubSponsors, fetchGitHubStars } from "@/lib/github";
import { CodeShowcase } from "./_components/code-showcase";
import { Features } from "./_components/features";
import { FooterCta } from "./_components/footer-cta";
import { Hero } from "./_components/hero";
import { Sponsors } from "./_components/sponsors";
import { Testimonials } from "./_components/testimonials";

export default async function HomePage() {
	const [stars, sponsors] = await Promise.all([fetchGitHubStars(), fetchGitHubSponsors()]);

	return (
		<>
			<Hero stars={stars} />
			<Testimonials />
			<Features />
			<CodeShowcase />
			<Sponsors data={sponsors} />
			<FooterCta />
		</>
	);
}
