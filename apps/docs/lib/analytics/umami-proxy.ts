// First-party proxy for the self-hosted Umami instance.
//
// The tracker is served from this site's own origin so that
// blockers matching the Umami host (e.g. EasyPrivacy's `||umami.*/script.js`)
// do not catch it. A Route Handler is used instead of a next.config rewrite
// because the visitor IP must be forwarded explicitly: behind the Cloudflare
// tunnel, Umami would otherwise see this server's IP and geolocate every
// visitor to the same place. Umami reads the header named by its
// CLIENT_IP_HEADER env var (set to `x-umami-client-ip` on the server).
//
// Only the script and the collect endpoint are proxied, so this cannot be
// used to reach the Umami dashboard or API.

const ALLOWED_PATHS: Record<string, RegExp> = {
	GET: /^script\.js$/,
	POST: /^api\/send$/,
};

// Request headers the Umami tracker sends and the server reads.
const FORWARDED_REQUEST_HEADERS = [
	"content-type",
	"user-agent",
	"x-umami-cache",
	"x-umami-website-id",
	"x-umami-hostname",
];

const SCRIPT_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400";

function getClientIp(headers: Headers) {
	return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || undefined;
}

export async function proxyUmami(request: Request, path: string[], umamiUrl: string | undefined) {
	const joinedPath = path.join("/");

	if (!umamiUrl || !ALLOWED_PATHS[request.method]?.test(joinedPath)) {
		return new Response("Not found", { status: 404 });
	}

	const headers = new Headers();
	for (const name of FORWARDED_REQUEST_HEADERS) {
		const value = request.headers.get(name);
		if (value) headers.set(name, value);
	}
	const clientIp = getClientIp(request.headers);
	if (clientIp) headers.set("x-umami-client-ip", clientIp);

	let upstream: Response;
	try {
		upstream = await fetch(`${umamiUrl.replace(/\/$/, "")}/${joinedPath}`, {
			method: request.method,
			headers,
			body: request.method === "POST" ? await request.arrayBuffer() : undefined,
			cache: "no-store",
			// A redirect means Cloudflare Access is blocking this path: fail instead of
			// returning the Access login page as JavaScript.
			redirect: "manual",
			signal: AbortSignal.timeout(10_000),
		});
	} catch {
		return new Response("Bad gateway", { status: 502 });
	}

	if (upstream.status >= 300 && upstream.status < 400) {
		return new Response("Bad gateway", { status: 502 });
	}

	const responseHeaders = new Headers();
	const contentType = upstream.headers.get("content-type");
	if (contentType) responseHeaders.set("content-type", contentType);

	const isScript = request.method === "GET";
	const cacheControl = isScript && upstream.ok ? SCRIPT_CACHE_CONTROL : upstream.headers.get("cache-control");
	responseHeaders.set("cache-control", cacheControl ?? "no-store");

	return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
