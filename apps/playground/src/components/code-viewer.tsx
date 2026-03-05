"use client";

import { CheckIcon, ClipboardIcon, CodeIcon, ExternalLinkIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import type { SourceCode } from "@/lib/shiki";

export function CodeViewer({ code, html, url, filename }: SourceCode) {
	const [open, setOpen] = useState(false);
	const [copied, setCopied] = useState(false);

	const copyToClipboard = async () => {
		await navigator.clipboard.writeText(code);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Collapsible open={open} onOpenChange={setOpen} className="min-w-0">
			<div className="flex flex-wrap items-center gap-2">
				<Button variant="ghost" size="xs" onClick={() => setOpen(!open)}>
					{open ? <EyeOffIcon /> : <CodeIcon />}
					{open ? "Hide Code" : "View Code"}
				</Button>
				{open ? (
					<>
						<Button variant="ghost" size="icon-xs" onClick={copyToClipboard} title="Copy code">
							{copied ? <CheckIcon /> : <ClipboardIcon />}
						</Button>
						<Button variant="ghost" size="xs" asChild>
							<a href={url} target="_blank" rel="noopener noreferrer">
								<ExternalLinkIcon />
								{filename}
							</a>
						</Button>
					</>
				) : null}
			</div>
			<CollapsibleContent>
				{/* Safe: HTML is generated server-side by Shiki from local repository source files. */}
				<div
					className="mt-2 min-w-0 overflow-x-auto rounded-md border text-xs [&_pre]:p-4"
					dangerouslySetInnerHTML={{ __html: html }}
				/>
			</CollapsibleContent>
		</Collapsible>
	);
}
