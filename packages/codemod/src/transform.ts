import { existsSync } from "node:fs";
import path from "node:path";
import {
	type CallExpression,
	type Expression,
	type ExportSpecifier,
	type ImportDeclaration,
	type ImportSpecifier,
	Node,
	Project,
	type SourceFile,
	type Symbol as MorphSymbol,
	SyntaxKind,
	ts,
	type TypeNode,
} from "ts-morph";
import {
	CLIENT_CHAIN_METHODS,
	isNsaModule,
	NSA_PACKAGE,
	RENAMED_TYPES,
	REMOVED_ENTRY,
	REPLACEMENT_ENTRY,
	RESIDUAL_PATTERNS,
	type RuleId,
} from "./rules";

export type Edit = { start: number; end: number; text: string; rule: RuleId };
export type Range = { start: number; end: number };

export type ManualItem = {
	rule: RuleId;
	file: string;
	line: number;
	column: number;
	snippet: string;
	why: string;
	fix: string;
	docs: string;
};

/** A manual item before line numbers are computed (positions are offsets in the original text). */
export type PendingManual = Omit<ManualItem, "file" | "line" | "column" | "snippet" | "docs"> & { pos: number };

export type FileAnalysis = {
	edits: Edit[];
	manual: PendingManual[];
	/** Ranges the AST pass proved unrelated or already reported: the residual scan skips them. */
	explained: Range[];
};

const FIX_TEXT: Record<"V9-01" | "V9-03", string> = {
	"V9-01": `Import from "${REPLACEMENT_ENTRY}" instead of "${REMOVED_ENTRY}".`,
	"V9-03":
		"If the receiver is a next-safe-action client, replace `.schema(` with `.inputSchema(`. Otherwise ignore this item.",
};

// ---------------------------------------------------------------------------------------------
// Project setup
// ---------------------------------------------------------------------------------------------

const FALLBACK_OPTIONS: ts.CompilerOptions = {
	allowJs: true,
	jsx: ts.JsxEmit.Preserve,
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
	target: ts.ScriptTarget.ESNext,
	esModuleInterop: true,
	resolveJsonModule: true,
};

const configCache = new Map<string, string | undefined>();

/** Nearest tsconfig.json or jsconfig.json walking up from `dir`. */
function findConfig(dir: string): string | undefined {
	if (configCache.has(dir)) return configCache.get(dir);
	let found: string | undefined;
	for (const name of ["tsconfig.json", "jsconfig.json"]) {
		const candidate = path.join(dir, name);
		if (existsSync(candidate)) {
			found = candidate;
			break;
		}
	}
	const parent = path.dirname(dir);
	if (!found && parent !== dir) found = findConfig(parent);
	configCache.set(dir, found);
	return found;
}

export type ProjectGroup = { project: Project; files: string[]; configError?: string; config?: string };

/** One ts-morph project per nearest config, holding only the candidate files (imports resolve lazily). */
export function createProjects(files: string[]): Map<string, ProjectGroup> {
	const groups = new Map<string, ProjectGroup>();
	for (const file of files) {
		const config = findConfig(path.dirname(file));
		const key = config ?? "";
		let group = groups.get(key);
		if (!group) {
			const base = { skipAddingFilesFromTsConfig: true, compilerOptions: { allowJs: true, noEmit: true } };
			try {
				group = config
					? { project: new Project({ ...base, tsConfigFilePath: config }), files: [], config }
					: { project: new Project({ compilerOptions: { ...FALLBACK_OPTIONS, noEmit: true } }), files: [] };
			} catch (error) {
				group = {
					project: new Project({ compilerOptions: { ...FALLBACK_OPTIONS, noEmit: true } }),
					files: [],
					config,
					configError: error instanceof Error ? error.message.split("\n")[0] : String(error),
				};
			}
			groups.set(key, group);
		}
		group.project.addSourceFileAtPath(file);
		group.files.push(file);
	}
	return groups;
}

// ---------------------------------------------------------------------------------------------
// Symbol helpers
// ---------------------------------------------------------------------------------------------

const isNsaDeclarationFile = (sf: SourceFile) => /[\\/]node_modules[\\/]next-safe-action[\\/]/.test(sf.getFilePath());

/** Module specifier of the import/export declaration that owns `node`, if any. */
function moduleOf(node: Node): string | undefined {
	const decl = node.getFirstAncestor((a) => Node.isImportDeclaration(a) || Node.isExportDeclaration(a));
	if (Node.isImportDeclaration(decl) || Node.isExportDeclaration(decl)) return decl.getModuleSpecifierValue();
	return undefined;
}

/** Name taken from the other module (ts-morph's `getNameNode()` is the property name when aliased). */
const importedName = (spec: ImportSpecifier | ExportSpecifier) => spec.getNameNode().getText();

type Trace = "nsa" | "other" | "unknown";

/**
 * Follows the alias chain of `symbol` and answers whether it is the next-safe-action export `name`.
 * The name must stay `name` on every hop, so a barrel that renames the export is never followed
 * (renaming the consumer would then break the barrel's public name).
 */
function traceNsaExport(symbol: MorphSymbol | undefined, name: string): Trace {
	let current = symbol;
	for (let hop = 0; current && hop < 32; hop++) {
		const decls = current.getDeclarations();
		if (decls.length === 0) return "unknown";
		for (const decl of decls) {
			if (isNsaDeclarationFile(decl.getSourceFile())) return current.getName() === name ? "nsa" : "other";
			if (Node.isImportSpecifier(decl) || Node.isExportSpecifier(decl)) {
				if (importedName(decl) !== name) return "other";
				const mod = moduleOf(decl);
				if (mod !== undefined && isNsaModule(mod)) return "nsa";
			}
		}
		if (!current.isAlias()) return "other";
		current = current.getImmediatelyAliasedSymbol();
	}
	return "unknown";
}

/** Whether `node` is an identifier bound to `import * as x from "next-safe-action[/...]"`. */
function isNsaNamespace(node: Node): boolean {
	if (!Node.isIdentifier(node)) return false;
	return (node.getSymbol()?.getDeclarations() ?? []).some((d) => {
		if (!Node.isNamespaceImport(d) && !Node.isNamespaceExport(d)) return false;
		const mod = moduleOf(d);
		return mod !== undefined && isNsaModule(mod);
	});
}

function isSafeActionClientTypeNode(typeNode: TypeNode | undefined): boolean {
	if (!Node.isTypeReference(typeNode)) return false;
	const typeName = typeNode.getTypeName();
	if (Node.isQualifiedName(typeName)) {
		return typeName.getRight().getText() === "SafeActionClient" && isNsaNamespace(typeName.getLeft());
	}
	return (
		typeName.getText() === "SafeActionClient" && traceNsaExport(typeName.getSymbol(), "SafeActionClient") === "nsa"
	);
}

// ---------------------------------------------------------------------------------------------
// V9-03: is the receiver of `.schema()` a safe action client?
// ---------------------------------------------------------------------------------------------

/**
 * client: proven SafeActionClient. factory: `createSafeActionClient` itself. nsaNs: namespace import
 * of next-safe-action. fn: a local function (its return value is not analyzed). other: proven
 * unrelated. unknown: could not decide.
 */
type Kind = "client" | "factory" | "nsaNs" | "fn" | "other" | "unknown";

const BARE_PACKAGE = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(?:\/.*)?$/i;

function unwrap(expr: Node): Node {
	let node = expr;
	while (
		Node.isParenthesizedExpression(node) ||
		Node.isAsExpression(node) ||
		Node.isSatisfiesExpression(node) ||
		Node.isNonNullExpression(node) ||
		Node.isTypeAssertion(node)
	) {
		node = node.getExpression();
	}
	return node;
}

/** `seen` holds the declarations on the current resolution path, so cycles end as "unknown". */
function resolveExpr(expr: Node, seen: Set<Node>): Kind {
	const node = unwrap(expr);

	if (Node.isCallExpression(node)) {
		const callee = unwrap(node.getExpression());
		if (Node.isPropertyAccessExpression(callee)) {
			const base = resolveExpr(callee.getExpression(), seen);
			if (base === "client") return CLIENT_CHAIN_METHODS.has(callee.getName()) ? "client" : "other";
			if (base === "nsaNs") return callee.getName() === "createSafeActionClient" ? "client" : "other";
			if (base === "other" || base === "factory") return "other";
			return "unknown";
		}
		const kind = resolveExpr(callee, seen);
		if (kind === "factory") return "client";
		if (kind === "other" || kind === "nsaNs" || kind === "client") return "other";
		return "unknown";
	}
	if (Node.isPropertyAccessExpression(node)) {
		const base = resolveExpr(node.getExpression(), seen);
		if (base === "nsaNs") return node.getName() === "createSafeActionClient" ? "factory" : "other";
		if (base === "client" || base === "factory") return "other";
		const symbol = node.getNameNode().getSymbol();
		if (symbol) return resolveSymbol(symbol, seen);
		return base === "other" ? "other" : "unknown";
	}
	if (Node.isIdentifier(node)) {
		const symbol = node.getSymbol();
		return symbol ? resolveSymbol(symbol, seen) : "unknown";
	}
	if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) return "fn";
	if (
		Node.isObjectLiteralExpression(node) ||
		Node.isArrayLiteralExpression(node) ||
		Node.isNewExpression(node) ||
		Node.isLiteralExpression(node) ||
		Node.isTemplateExpression(node) ||
		Node.isClassExpression(node)
	) {
		return "other";
	}
	return "unknown";
}

function resolveSymbol(symbol: MorphSymbol, seen: Set<Node>): Kind {
	let current: MorphSymbol | undefined = symbol;
	for (let hop = 0; current && hop < 32; hop++) {
		const decl = current.getDeclarations()[0];
		if (!decl || seen.has(decl)) return "unknown";
		seen.add(decl);
		if (isNsaDeclarationFile(decl.getSourceFile())) {
			return current.getName() === "createSafeActionClient" ? "factory" : "other";
		}
		if (
			Node.isImportSpecifier(decl) ||
			Node.isExportSpecifier(decl) ||
			Node.isImportClause(decl) ||
			Node.isNamespaceImport(decl) ||
			Node.isNamespaceExport(decl)
		) {
			const mod = moduleOf(decl);
			if (mod !== undefined && isNsaModule(mod)) {
				if (Node.isNamespaceImport(decl) || Node.isNamespaceExport(decl)) return "nsaNs";
				if (Node.isImportSpecifier(decl) || Node.isExportSpecifier(decl)) {
					return importedName(decl) === "createSafeActionClient" ? "factory" : "other";
				}
				return "other";
			}
			const next: MorphSymbol | undefined = current.isAlias() ? current.getImmediatelyAliasedSymbol() : undefined;
			if (!next || next.getDeclarations().length === 0) {
				// Unresolvable import: a bare package that is not next-safe-action cannot hand out a
				// client of this project; anything else (relative path, path alias) stays unknown.
				return mod !== undefined && BARE_PACKAGE.test(mod) && !/^[@~#]\//.test(mod) ? "other" : "unknown";
			}
			current = next;
			continue;
		}
		if (Node.isExportAssignment(decl)) return resolveExpr(decl.getExpression(), seen);
		if (Node.isVariableDeclaration(decl)) {
			if (isSafeActionClientTypeNode(decl.getTypeNode())) return "client";
			const init = decl.getInitializer();
			if (init) return resolveExpr(init, seen);
			return decl.getTypeNode() ? "other" : "unknown";
		}
		if (Node.isParameterDeclaration(decl) || Node.isPropertyDeclaration(decl) || Node.isPropertySignature(decl)) {
			if (isSafeActionClientTypeNode(decl.getTypeNode())) return "client";
			const init = Node.isPropertyDeclaration(decl) ? decl.getInitializer() : undefined;
			return init ? resolveExpr(init, seen) : "unknown";
		}
		if (Node.isPropertyAssignment(decl)) {
			const init = decl.getInitializer();
			return init ? resolveExpr(init, seen) : "unknown";
		}
		if (Node.isFunctionDeclaration(decl) || Node.isMethodDeclaration(decl)) return "fn";
		if (
			Node.isClassDeclaration(decl) ||
			Node.isEnumDeclaration(decl) ||
			Node.isModuleDeclaration(decl) ||
			Node.isInterfaceDeclaration(decl) ||
			Node.isTypeAliasDeclaration(decl) ||
			Node.isSourceFile(decl)
		) {
			return "other";
		}
		return "unknown";
	}
	return "unknown";
}

/** Type-based proof, only conclusive when next-safe-action is installed: the receiver's type is `SafeActionClient`. */
function hasClientType(expr: Expression): boolean {
	try {
		const type = expr.getType();
		const symbol = type.getSymbol() ?? type.getAliasSymbol();
		return (
			symbol?.getName() === "SafeActionClient" &&
			symbol.getDeclarations().some((d) => isNsaDeclarationFile(d.getSourceFile()))
		);
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------------------------

function lineEndAfter(text: string, pos: number) {
	if (text.startsWith("\r\n", pos)) return pos + 2;
	if (text[pos] === "\n") return pos + 1;
	return pos;
}

/**
 * Edits that remove the `dropped` named imports of `decl`, keeping the rest of it. Without named
 * imports left, the whole line goes, or only `, { ... }` after a default import.
 */
function removeSpecifiers(text: string, decl: ImportDeclaration, dropped: Set<ImportSpecifier>): Edit[] {
	const elements = decl.getNamedImports();
	const rule = "V9-02";
	if (elements.every((e) => dropped.has(e))) {
		const defaultImport = decl.getDefaultImport();
		const named = decl.getImportClause()?.getNamedBindings();
		if (defaultImport && named) return [{ start: defaultImport.getEnd(), end: named.getEnd(), text: "", rule }];
		return [{ start: decl.getStart(), end: lineEndAfter(text, decl.getEnd()), text: "", rule }];
	}
	// A dropped run at the end goes with the comma before it (`{ A, B }` -> `{ A }`, a trailing comma
	// stays); every other dropped specifier goes with the separator after it.
	let tail = elements.length;
	while (dropped.has(elements[tail - 1]!)) tail--;
	const edits: Edit[] = [];
	for (let i = 0; i < tail; i++) {
		if (dropped.has(elements[i]!)) {
			edits.push({ start: elements[i]!.getStart(), end: elements[i + 1]!.getStart(), text: "", rule });
		}
	}
	if (tail < elements.length) {
		edits.push({ start: elements[tail - 1]!.getEnd(), end: elements.at(-1)!.getEnd(), text: "", rule });
	}
	return edits;
}

/** `vi.mock(...)`, `jest.mock(...)`, and their `doMock` variants. */
function isMockCall(call: Node | undefined): call is CallExpression {
	if (!Node.isCallExpression(call)) return false;
	const callee = call.getExpression();
	return (
		Node.isPropertyAccessExpression(callee) &&
		["vi", "jest"].includes(callee.getExpression().getText()) &&
		["mock", "doMock"].includes(callee.getName())
	);
}

/** Computes every edit for one file without mutating it. */
export function analyzeFile(sf: SourceFile): FileAnalysis {
	const text = sf.getFullText();
	const edits: Edit[] = [];
	const manual: PendingManual[] = [];
	const explained: Range[] = [];
	const explain = (node: Node) => explained.push({ start: node.getStart(), end: node.getEnd() });
	const replace = (node: Node, newText: string, rule: RuleId) =>
		edits.push({ start: node.getStart(), end: node.getEnd(), text: newText, rule });

	// ---- V9-01: removed entry point, in any string literal (imports, exports, import(), require(), vi.mock()...).
	const handledLiterals = new Set<Node>();
	const hooksImports = sf
		.getImportDeclarations()
		.filter(
			(d) => d.getModuleSpecifierValue() === REPLACEMENT_ENTRY && !d.getDefaultImport() && !d.getNamespaceImport()
		);
	for (const decl of sf.getImportDeclarations()) {
		if (decl.getModuleSpecifierValue() !== REMOVED_ENTRY) continue;
		if (decl.getDefaultImport() || decl.getNamespaceImport() || decl.getNamedImports().length === 0) continue;
		const target = hooksImports.find((d) => d.isTypeOnly() === decl.isTypeOnly() && d.getNamedImports().length > 0);
		if (!target) continue;
		// Merge into the existing hooks import instead of leaving two declarations for the same module.
		const existing = new Set(target.getNamedImports().map((s) => s.getText()));
		const toAdd = decl
			.getNamedImports()
			.map((s) => s.getText())
			.filter((s) => !existing.has(s));
		const last = target.getNamedImports().at(-1)!;
		if (toAdd.length > 0)
			edits.push({ start: last.getEnd(), end: last.getEnd(), text: `, ${toAdd.join(", ")}`, rule: "V9-01" });
		edits.push({ start: decl.getStart(), end: lineEndAfter(text, decl.getEnd()), text: "", rule: "V9-01" });
		handledLiterals.add(decl.getModuleSpecifier());
	}
	for (const literal of [
		...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
		...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
	]) {
		if (literal.getLiteralText() !== REMOVED_ENTRY || handledLiterals.has(literal)) continue;
		edits.push({ start: literal.getStart() + 1, end: literal.getEnd() - 1, text: REPLACEMENT_ENTRY, rule: "V9-01" });
		const call = literal.getParent();
		if (isMockCall(call) && call.getArguments()[0] === literal && call.getArguments().length > 1) {
			manual.push({
				rule: "V9-01",
				pos: literal.getStart(),
				why: `This mock factory used to replace only "${REMOVED_ENTRY}". It now replaces all of "${REPLACEMENT_ENTRY}", so every hook it does not return (for example \`useAction\`) is \`undefined\` in this test file.`,
				fix: `Spread the real module into the factory: \`...(await vi.importActual("${REPLACEMENT_ENTRY}"))\` with Vitest, or \`...jest.requireActual("${REPLACEMENT_ENTRY}")\` with Jest. If the factory already returns every hook the tests use, ignore this item.`,
			});
		}
	}

	// ---- V9-02: removed type aliases.
	const renameLocal = new Map<ts.Symbol, string | null>(); // local import symbol -> new name, or null when kept aliased
	const nsaImportsOf = (name: string) =>
		sf
			.getImportDeclarations()
			.flatMap((d) =>
				isNsaModule(d.getModuleSpecifierValue())
					? d.getNamedImports().filter((s) => (s.getAliasNode() ?? s.getNameNode()).getText() === name)
					: []
			);
	const hasConflict = (name: string) =>
		sf.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => {
			if (id.getText() !== name) return false;
			const parent = id.getParent();
			if (Node.isImportSpecifier(parent) && isNsaModule(moduleOf(parent) ?? "")) return false;
			const decl = id.getSymbol()?.getDeclarations()[0];
			return !(Node.isImportSpecifier(decl) && isNsaModule(moduleOf(decl) ?? ""));
		});

	const dropped = new Set<ImportSpecifier>();
	const specifiers = [
		...sf.getDescendantsOfKind(SyntaxKind.ImportSpecifier),
		...sf.getDescendantsOfKind(SyntaxKind.ExportSpecifier).filter((s) => moduleOf(s) !== undefined),
	];
	for (const spec of specifiers) {
		const from = importedName(spec);
		const to = RENAMED_TYPES.get(from);
		if (!to) continue;
		const mod = moduleOf(spec);
		const trace = mod !== undefined && isNsaModule(mod) ? "nsa" : traceNsaExport(spec.getSymbol(), from);
		if (trace === "other") explain(spec);
		if (trace !== "nsa") continue;

		if (spec.getAliasNode()) {
			// `{ DVES as Local }`: only the imported name changes, the local alias stays.
			replace(spec.getNameNode(), to, "V9-02");
			explain(spec);
			continue;
		}
		if (Node.isExportSpecifier(spec)) {
			// `export { DVES } from "..."`: the export is renamed too; in-scope consumers follow via the trace.
			replace(spec.getNameNode(), to, "V9-02");
			continue;
		}
		const localSymbol = spec.getSymbol()?.compilerSymbol;
		if (nsaImportsOf(to).length > 0) {
			// The new name is already imported: drop the old specifier, references switch to the existing import.
			dropped.add(spec);
			if (localSymbol) renameLocal.set(localSymbol, to);
		} else if (hasConflict(to)) {
			// Another `to` already exists in this file: import under the old local name instead.
			replace(spec.getNameNode(), `${to} as ${from}`, "V9-02");
			if (localSymbol) renameLocal.set(localSymbol, null);
		} else {
			replace(spec.getNameNode(), to, "V9-02");
			if (localSymbol) renameLocal.set(localSymbol, to);
		}
	}

	for (const decl of new Set([...dropped].map((spec) => spec.getImportDeclaration()))) {
		edits.push(...removeSpecifiers(text, decl, dropped));
	}

	for (const id of sf.getDescendantsOfKind(SyntaxKind.Identifier)) {
		const from = id.getText();
		const to = RENAMED_TYPES.get(from);
		if (!to) continue;
		const parent = id.getParent();
		if ((Node.isImportSpecifier(parent) || Node.isExportSpecifier(parent)) && moduleOf(parent) !== undefined) {
			// The imported name was handled above; a local alias is the user's own name (`{ X as DVES }`).
			if (parent.getAliasNode() === id) explain(id);
			continue;
		}

		// `nsa.DVES` through a namespace import, and `import("next-safe-action").DVES`.
		if (Node.isQualifiedName(parent) && parent.getRight() === id && isNsaNamespace(parent.getLeft())) {
			replace(id, to, "V9-02");
			continue;
		}
		if (Node.isImportTypeNode(parent)) {
			const argument = parent.getArgument();
			const literal = Node.isLiteralTypeNode(argument) ? argument.getLiteral() : undefined;
			if (Node.isStringLiteral(literal) && isNsaModule(literal.getLiteralValue())) {
				replace(id, to, "V9-02");
				continue;
			}
		}

		const symbol = Node.isExportSpecifier(parent) ? parent.getLocalTargetSymbol() : id.getSymbol();
		const action = symbol ? renameLocal.get(symbol.compilerSymbol) : undefined;
		if (action !== undefined) {
			if (action === null) {
				// Kept under the old local name. A bare `export { DVES }` still has to export the new name,
				// because consumers that import it from this file are renamed.
				if (Node.isExportSpecifier(parent) && !parent.getAliasNode()) replace(id, `${from} as ${to}`, "V9-02");
				else explain(id);
			} else {
				replace(id, action, "V9-02");
			}
			continue;
		}
		const trace = traceNsaExport(symbol, from);
		if (trace === "nsa") replace(id, to, "V9-02");
		else if (trace === "other") explain(id);
		// "unknown": left for the residual scan, which reports it.
	}

	// ---- V9-03: `.schema()` on a safe action client.
	for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
		const callee = call.getExpression();
		let nameNode: Node;
		if (Node.isPropertyAccessExpression(callee) && callee.getName() === "schema") {
			nameNode = callee.getNameNode();
		} else if (Node.isElementAccessExpression(callee)) {
			const arg = callee.getArgumentExpression();
			const isString = Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg);
			if (!isString || arg.getLiteralText() !== "schema") continue;
			nameNode = arg;
		} else {
			continue;
		}
		const receiver = callee.getExpression();
		let kind = resolveExpr(receiver, new Set());
		if ((kind === "unknown" || kind === "fn") && hasClientType(receiver)) kind = "client";
		if (kind === "client") {
			// For `client["schema"]`, only the text between the quotes changes.
			const quoted = Node.isPropertyAccessExpression(callee) ? 0 : 1;
			edits.push({
				start: nameNode.getStart() + quoted,
				end: nameNode.getEnd() - quoted,
				text: "inputSchema",
				rule: "V9-03",
			});
		} else if (kind === "unknown" || kind === "fn") {
			manual.push({
				rule: "V9-03",
				pos: nameNode.getStart(),
				why: '`.schema()` was removed from the safe action client, and the codemod could not prove whether this receiver is a client: its chain does not resolve to `createSafeActionClient()` from "next-safe-action" (for example a wrapper function, a parameter without a `SafeActionClient` type, or a dynamic value).',
				fix: FIX_TEXT["V9-03"],
			});
			explain(callee);
		} else {
			explain(callee);
		}
	}

	return { edits: dedupe(edits), manual, explained };
}

/** Sorts edits and drops any that overlaps an earlier one (defensive: rules never target the same node). */
function dedupe(edits: Edit[]): Edit[] {
	const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
	const out: Edit[] = [];
	for (const edit of sorted) {
		const prev = out.at(-1);
		if (prev && edit.start < prev.end) continue;
		out.push(edit);
	}
	return out;
}

export function applyEdits(text: string, edits: Edit[]): string {
	let out = "";
	let cursor = 0;
	for (const edit of edits) {
		out += text.slice(cursor, edit.start) + edit.text;
		cursor = edit.end;
	}
	return out + text.slice(cursor);
}

/** Maps an offset in the original text to the transformed text. */
export function mapOffset(pos: number, edits: Edit[]): number {
	let delta = 0;
	for (const edit of edits) {
		if (edit.end > pos) break;
		delta += edit.text.length - (edit.end - edit.start);
	}
	return pos + delta;
}

/** Regex scan for leftovers: every match outside `covered` becomes a manual item. */
export function residualScan(text: string, covered: Range[]): PendingManual[] {
	const out: PendingManual[] = [];
	for (const { rule, regex } of RESIDUAL_PATTERNS) {
		for (const match of text.matchAll(regex)) {
			const start = match.index;
			const end = start + match[0].length;
			if (covered.some((r) => r.start < end && start < r.end)) continue;
			out.push({
				rule,
				pos: start,
				why: `Found \`${match[0]}\` where the codemod cannot rewrite it safely (a comment, a string, JSDoc, a non-JS file, an unparsable file, or an identifier it could not trace to "${NSA_PACKAGE}").`,
				fix:
					rule === "V9-02"
						? `If it refers to the next-safe-action type, rename \`${match[0]}\` to \`${RENAMED_TYPES.get(match[0])}\` (same generic parameters).`
						: FIX_TEXT[rule as "V9-01" | "V9-03"],
			});
		}
	}
	return out;
}
