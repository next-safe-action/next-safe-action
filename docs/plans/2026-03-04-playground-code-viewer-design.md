# Playground Code Viewer Design

## Context

The playground app at `apps/playground/` showcases next-safe-action examples but provides no way to view the underlying source code. Users must navigate to GitHub manually to see how actions are defined. This feature adds an inline code viewer to each example card, letting users toggle the action's source code directly in the playground, with syntax highlighting and a link to view on GitHub.

## Decisions

- **Scope**: Action files only (`_actions/*.ts`) — not page components or `_components/` files
- **UI**: Per-card "View Code" toggle button that expands/collapses inline
- **Highlighting**: Shiki with GitHub Light / GitHub Dark dual themes (zero client JS)
- **Architecture**: Server Component reads files + highlights → passes pre-rendered HTML to client components

## Architecture

### Data Flow

```
page.tsx (Server Component)
  │
  ├── fs.readFileSync("_actions/direct-action.ts")
  ├── Shiki codeToHtml() → highlighted HTML string
  │
  └── <ClientPage sources={{ directAction: { code, html, url, filename } }}>
        │
        └── <ExampleCard source={sources.directAction}>
              │
              └── <CodeViewer code={...} html={...} url={...} filename={...} />
                    ├── "View Code" / "Hide Code" toggle
                    ├── Syntax-highlighted code block (Shiki pre-rendered HTML)
                    ├── Copy button (clipboard API)
                    └── "View on GitHub" link
```

### Source Code Type

```ts
type SourceCode = {
  code: string;     // raw source for clipboard copy
  html: string;     // Shiki-highlighted HTML (safe — generated from local files at build time)
  url: string;      // GitHub permalink
  filename: string; // e.g., "direct-action.ts"
};
```

**Security note**: The HTML is generated server-side by Shiki from local source files that are part of the repository. There is no user input involved — the content is trusted and static, similar to how documentation sites like Fumadocs render syntax-highlighted code.

## New Files

### `src/lib/shiki.ts`

Server-only utility:
- `getHighlighter()` — cached Shiki highlighter singleton (React `cache()`)
- `readAndHighlightFile(appRelativePath: string)` → `Promise<SourceCode>`
  - Reads file with `fs.readFileSync`
  - Highlights with Shiki dual themes (`github-light` / `github-dark`, `defaultColor: false`)
  - Constructs GitHub URL from path
  - Returns `{ code, html, url, filename }`

GitHub base: `https://github.com/TheEdoRan/next-safe-action/blob/main/apps/playground/src/app/`
(reuses existing URL from `app-sidebar.tsx` line 107)

### `src/components/code-viewer.tsx`

`"use client"` component:
- **Props**: `code: string`, `html: string`, `url: string`, `filename: string`
- **Toggle button**: shadcn Button with `CodeIcon` / `EyeOffIcon` from lucide-react
- **Code block**: Renders Shiki's pre-highlighted HTML output (safe — generated from trusted local source files at build time, no user input)
- **Copy button**: Uses `navigator.clipboard.writeText(code)`
- **GitHub link**: External link icon + "View on GitHub" text
- **Animation**: Collapsible using shadcn Collapsible component

### CSS for Shiki dual themes

Add to global CSS or a dedicated stylesheet. With `defaultColor: false`, Shiki outputs CSS variables:
```css
html:not(.dark) .shiki span { color: var(--shiki-light) !important; }
html:not(.dark) .shiki { background-color: var(--shiki-light-bg) !important; }
html.dark .shiki span { color: var(--shiki-dark) !important; }
html.dark .shiki { background-color: var(--shiki-dark-bg) !important; }
```

## Modified Files

### `src/components/example-card.tsx`

Add optional `source?: SourceCode` prop. When present, renders `<CodeViewer>` inside the card (in the header area or between header and content).

### Pages — Already Server Components (add file reading)

These pages already delegate to `_components/` client components. Just add file reading + pass `source` props.

| Page | Demo components to modify | Action files |
|------|--------------------------|-------------|
| `hooks/page.tsx` | HookDemo, StatelessFormDemo, StateUpdateDemo | 3 |
| `optimistic-updates/page.tsx` | AddTodoForm, RevalidationDemo | 2 |
| `forms/page.tsx` | StatefulFormDemo, FileUploadDemo, BindArgumentsDemo | 3 |
| `react-hook-form/page.tsx` | HookFormActionDemo, HookFormOptimisticDemo, ErrorMapperDemo | 2 |

Each demo component gets an optional `source?: SourceCode` prop and passes it to its ExampleCard.

### Pages — Need Restructuring (split server/client)

These have `"use client"` with inline interactive content. Split into server page + client component.

| Page | New client component | Action files |
|------|---------------------|-------------|
| `core-actions/page.tsx` | `_components/core-actions-client.tsx` | 6 |
| `validation-errors/page.tsx` | `_components/validation-errors-client.tsx` | 5 |
| `middleware/page.tsx` | `_components/middleware-client.tsx` | 5 |
| `navigation-framework/page.tsx` | `_components/navigation-client.tsx` | 1 |

### Total: 27 action files across 8 pages

## Verification

1. `pnpm run build:lib` — library builds
2. `pnpm run pg` — playground starts without errors
3. Visit each of the 8 example pages
4. Click "View Code" on several ExampleCards — syntax-highlighted code appears
5. Toggle light/dark theme — code block colors switch correctly
6. Click "Copy" — raw source code copied to clipboard
7. Click "View on GitHub" — opens correct file on GitHub
8. Click "View Code" again — code block collapses
