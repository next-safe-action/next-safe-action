import { proxyUmami } from "@/lib/analytics/umami-proxy";

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, { params }: Context) {
	return proxyUmami(request, (await params).path, process.env.UMAMI_URL);
}

export async function POST(request: Request, { params }: Context) {
	return proxyUmami(request, (await params).path, process.env.UMAMI_URL);
}
