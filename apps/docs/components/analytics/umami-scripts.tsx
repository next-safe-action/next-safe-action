import { OutboundLinkTracking } from "./outbound-link-tracking";

// The tracker is served through the first-party proxy in app/api/u/[...path]
// and sends data to the directory it is loaded from, so no data-host-url is
// needed. data-domains keeps preview deployments out. Session replay and
// heatmaps (recorder.js) are intentionally not loaded.
// UMAMI_WEBSITE_ID is read at build time, because the root layout is static.
export function UmamiScripts() {
	const websiteId = process.env.UMAMI_WEBSITE_ID;
	if (process.env.NODE_ENV !== "production" || !websiteId) return null;
	return (
		<>
			<script
				defer
				src="/api/u/script.js"
				data-website-id={websiteId}
				data-domains="next-safe-action.dev"
				data-performance="true"
				data-errors="true"
			/>
			<OutboundLinkTracking />
		</>
	);
}
