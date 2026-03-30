import * as Twoslash from "fumadocs-twoslash/ui";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Card, Cards } from "fumadocs-ui/components/card";
import { Step, Steps } from "fumadocs-ui/components/steps";
import * as TabsComponents from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultMdxComponents from "fumadocs-ui/mdx";

export function useMDXComponents(components: Record<string, any>): Record<string, any> {
	return {
		...defaultMdxComponents,
		...TabsComponents,
		...Twoslash,
		Accordion,
		Accordions,
		Step,
		Steps,
		TypeTable,
		Card,
		Cards,
		img: (props: React.ComponentProps<"img">) => <img {...props} />,
		...components,
	};
}
