import defaultMdxComponents from "fumadocs-ui/mdx";
import * as TabsComponents from "fumadocs-ui/components/tabs";
import * as Twoslash from "fumadocs-twoslash/ui";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { TypeTable } from "fumadocs-ui/components/type-table";
import { Card, Cards } from "fumadocs-ui/components/card";

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
		...components,
	};
}
