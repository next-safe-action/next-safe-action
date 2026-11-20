"use client";

import { useEffect } from "react";

declare global {
	interface Window {
		umami?: { track: (name: string, data?: Record<string, string>) => void };
	}
}

// Umami has no automatic outbound link tracking, so clicks on external links
// (including middle clicks) are sent as a custom event.
export function OutboundLinkTracking() {
	useEffect(() => {
		const onClick = (event: MouseEvent) => {
			const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
			if (!(link instanceof HTMLAnchorElement) || link.host === window.location.host) return;
			if (link.protocol !== "https:" && link.protocol !== "http:") return;
			window.umami?.track("Outbound Link: Click", { url: link.href });
		};

		document.addEventListener("click", onClick, { capture: true });
		document.addEventListener("auxclick", onClick, { capture: true });
		return () => {
			document.removeEventListener("click", onClick, { capture: true });
			document.removeEventListener("auxclick", onClick, { capture: true });
		};
	}, []);

	return null;
}
