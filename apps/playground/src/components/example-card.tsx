import type { ReactNode } from "react";
import { CodeViewer } from "@/components/code-viewer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SourceCode } from "@/lib/shiki";

type Props = {
	title: string;
	description?: string;
	source?: SourceCode;
	children: ReactNode;
};

export function ExampleCard({ title, description, source, children }: Props) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				{description ? <CardDescription>{description}</CardDescription> : null}
				{source ? <CodeViewer {...source} /> : null}
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}
