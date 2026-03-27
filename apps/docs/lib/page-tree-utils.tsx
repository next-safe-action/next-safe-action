import type { Root, Node, Folder } from "fumadocs-core/page-tree";

export function addSidebarBadge(tree: Root, url: string, badge: string): Root {
	return {
		...tree,
		children: tree.children.map((node) => decorateNode(node, url, badge)),
	};
}

function decorateNode(node: Node, url: string, badge: string): Node {
	if (node.type === "page" && node.url === url) {
		return {
			...node,
			name: (
				<>
					{node.name}
					<span className="bg-fd-primary/10 text-fd-primary ms-auto rounded-md px-1.5 py-0.5 text-[10px] font-semibold">
						{badge}
					</span>
				</>
			),
		};
	}

	if (node.type === "folder") {
		return {
			...node,
			children: (node as Folder).children.map((child) => decorateNode(child, url, badge)),
		};
	}

	return node;
}
