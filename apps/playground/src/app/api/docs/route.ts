// Scalar API reference, loaded from a pinned CDN build with Subresource Integrity. No npm dependency needed.
const html = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<link rel="icon" href="/img/favicon.ico" />
		<title>API reference | next-safe-action playground</title>
	</head>
	<body>
		<div id="app"></div>
		<script
			src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.1/dist/browser/standalone.js"
			integrity="sha384-U11tb2XnKvmwt8RlTvnwUnYgrN+ur4Xyh9htLhjajWNR/Oyl5AX5DEz00qRmlrmK"
			crossorigin="anonymous"
		></script>
		<script>
			Scalar.createApiReference("#app", { url: "/api/openapi.json" });
		</script>
	</body>
</html>`;

export function GET() {
	return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
