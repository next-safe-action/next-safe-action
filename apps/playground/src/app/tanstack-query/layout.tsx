import type { ReactNode } from "react";
import { QueryProvider } from "./_providers/query-provider";

export default function TanStackQueryLayout({ children }: { children: ReactNode }) {
	return <QueryProvider>{children}</QueryProvider>;
}
