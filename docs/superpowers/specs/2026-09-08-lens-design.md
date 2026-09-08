# lens — design

Date: 2026-09-08

A React library for lane-based architecture diagrams with the look and feel of
[pr-lens](https://github.com/coldteadotai/pr-lens), where every card can host a
live chart. The first consumer is a hand-authored chart of data entering the
organisation.

Upstream's layout engine is ported; its SVG-string painter is replaced by React
components styled with Tailwind v4.

## Goals

- Hand-authored documents: explicit row placement per node, automatic fallback.
- Deterministic layout: same document → same geometry, every time.
- Cards are containers: a render-prop fills the card body with any React
  content, sized by layout so nothing shifts when a chart mounts.
- Theme by CSS custom properties; dark mode is a class flip.
- Example app in the repo that exercises the library with fake live data.

## Non-goals (v1)

- Data-flow / sequence lens. The schema leaves room (`flows` can be added
  later without breaking documents).
- Walkthrough tours, manifests, content hashing, standalone SVG output.
- Bundled chart library. Consumers bring their own.
- Diff/PR vocabulary: provenance, stats, file refs, baseline patches,
  corrections.

## Package

- Name: `@unpunnyfuns/lens` (placeholder; `lens` is taken on npm).
- Single package, npm. MIT. Upstream's copyright notice preserved in
  `LICENSE` — the layout engine is substantially theirs.
- Exports:
  - `.` — `Diagram`, sub-components, types, `parseDocument`.
  - `./layout` — pure layout engine, no React.
  - `./theme.css` — Tailwind v4 `@theme` tokens.
- Peers: `react ^19`, `react-dom ^19`, `tailwindcss ^4`. Dependency: `zod ^4`.
- Layout:

```
src/
  schema/        zod schemas + inferred types, parseDocument
  layout/        rank, seating, edges, congestion, labels, architecture, scope, geometry, bounds, text
  components/    Diagram, Lane, Card, Badge, EdgeLayer, icons
  theme.css
  index.ts
  layout.ts      entry for ./layout
example/         Vite app (see below)
docs/superpowers/specs/
```

## 1. Document

```ts
type Document = {
  version: 1
  title: string
  summary?: string
  lanes: Lane[]            // 1–16
  nodes: Node[]            // 1–256
  edges?: Edge[]           // ≤512, default []
  views?: View[]           // ≤32, default []
}

type Status = "neutral" | "positive" | "caution" | "critical"

type Lane = {
  id: string
  label: string
  subtitle?: string
  order?: number           // left-to-right; ties fall back to array order
  status?: Status
  summary?: string
}

type NodeKind =
  | "service" | "app" | "module" | "function" | "route" | "job" | "queue"
  | "datastore" | "cache" | "external" | "ui" | "config" | "test" | "package" | "other"

type Node = {
  id: string
  label: string
  kind: NodeKind
  lane: string             // lane id
  row?: number             // explicit row within the lane; absent → derived from edges
  group?: string
  subtitle?: string
  summary?: string
  status?: Status          // default neutral
  badges?: { label: string; tone?: Status }[]   // ≤6
  size?: "compact" | "chart" | number           // card height; default compact
}

type EdgeKind =
  | "call" | "http" | "rpc" | "event" | "queue" | "data" | "dependency" | "render" | "other"

type Edge = {
  id: string
  from: string
  to: string
  kind: EdgeKind
  label?: string
  emphasis?: "normal" | "hero" | "muted"        // default normal
  animated?: boolean                            // default false
  status?: Status
  summary?: string
}

type View = {
  id: string
  title: string
  summary?: string
  scope?: { kind: "all" }
        | { kind: "selection"; lanes?: string[]; nodes?: string[]; edges?: string[] }
  children?: View[]
}
```

String limits carry over from upstream: ids ≤128, labels ≤120, summaries ≤2000.
`parseDocument(input: unknown): Document` applies defaults and throws a
`LensDocumentError` with zod's issue list on failure. Integrity checks beyond
zod's reach (every `node.lane` names a lane, every edge endpoint names a node,
ids unique per collection, view scopes name real elements) run in the same
call.

### Status is colour only

Upstream's `delta: removed` did layout work — parked dead nodes in a band
under the living ones, exiled their edges to a spare corridor, struck through
titles, and auto-added `NEW` / `CHANGED` / `REMOVED` badges. None of that
applies to a generic status. In lens, status affects card border tint, edge
stroke colour, and badge tone. Nothing else. The dead-band paths in seating
and routing are not ported.

### Explicit rows

`node.row` is an absolute slot inside its lane, not a hint. Two nodes claiming
the same row in one lane sit side by side, in array order; a third throws
during layout (upstream pairs at most two per row, and that stays). Nodes
without `row` are placed by the rank algorithm into rows not already claimed
in their lane, so mixing explicit and automatic placement works.

## 2. Layout engine (`./layout`)

Pure functions, no DOM, no React. Ported from upstream `packages/renderer/src/layout`:

| Module | Role | Changes from upstream |
|---|---|---|
| `rank.ts` | layer index per node from edges | honours explicit `row` first |
| `seating.ts` | nodes into lane rows | living/dead split removed |
| `edges.ts` | orthogonal routing through corridors, track assignment | dead-edge exile removed; tone from `status` |
| `congestion.ts` | widens corridors/bands when tracks compress | none |
| `labels.ts` | edge-label placement avoiding cards | none |
| `architecture.ts` | boxes for lanes and cards, grid for the router | card height from `size`; title-fitting removed |
| `scope.ts` | view → subset of document | `flows` removed |
| `geometry.ts`, `bounds.ts` | Box, rounding, canvas shifting | none |
| `text.ts` | font-advance width table | kept only for edge-label collision estimates |
| `design.ts` | layout constants | card height constants become defaults |

```ts
type CardHeights = { compact: number; withSubtitle: number; chart: number }
// defaults: 52, 62, 140

type LayoutOptions = { view?: string; cardHeights?: Partial<CardHeights> }

type Layout = {
  width: number
  height: number
  lanes: { lane: Lane; box: Box }[]
  nodes: { node: Node; box: Box; row: number; laneIndex: number; showIcon: boolean }[]
  edges: {
    edge: Edge
    path: string                       // SVG path data
    label?: { text: string; anchor: Point; box: Box }
    tone: Status
    from: Point; to: Point             // endpoints, for arrowheads
  }[]
  atlas: { lanes: Record<string, Box>; nodes: Record<string, Box>; edges: Record<string, Box> }
}

const layout = (doc: Document, options?: LayoutOptions): Layout
```

Rows take the tallest card in them. A `chart` card reserves `cardHeights.chart`;
a numeric `size` is used as-is. Errors are `LensLayoutError` with a code:
`NOTHING_TO_RENDER`, `UNKNOWN_VIEW`, `ROW_OVERFULL`.

Determinism: no clock, no randomness, no measurement. Iteration order is
array order everywhere; ties break by index.

## 3. React components

```tsx
<Diagram
  doc={doc}
  view={viewId}
  selected={["kafka"]}          // optional; everything else dims
  onNodeClick={(id) => ...}
  onEdgeClick={(id) => ...}
  cardHeights={{ chart: 160 }}
  className="..."
>
  {(node) => node.size === "chart" ? <Throughput source={node.id} /> : null}
</Diagram>
```

`Diagram` calls `layout()` inside `useMemo` keyed on `(doc, view, cardHeights)`
and renders a `relative` container of `layout.width × layout.height` with
three layers, in DOM order:

1. **Lanes** — absolutely positioned `div`s. Rounded band, dot-grid
   background, tracked uppercase header (`label · subtitle`), CSS-truncated.
2. **EdgeLayer** — one `svg` at `inset-0`, `aria-hidden`, `pointer-events-none`.
   Per edge: a path with tone stroke; `hero` widens, `muted` fades; an
   arrowhead `marker` per tone (filled for all kinds; upstream's open head was
   sequence-diagram-only); a label pill at `label.anchor`; an
   `animateMotion` pulse when `animated`, suppressed under
   `prefers-reduced-motion`. When `onEdgeClick` is set, each edge also gets a
   transparent 12px-wide hit path with pointer events enabled.
3. **Cards** — absolutely positioned. Layout, top to bottom: badge strip
   floating above the top-right corner; header row with kind icon chip and
   title (CSS truncate); subtitle in mono; then the **body slot** — a
   `flex-1 min-h-0` box filled by the children render-prop. A `compact` card
   has no slot. Because height comes from layout, a chart mounting late
   changes nothing around it.

`selected` dims every lane, card and edge not in the set (and not adjacent:
an edge stays lit if either endpoint is selected). It reuses the same opacity
treatment upstream applies to `muted`.

Sub-components `Lane`, `Card`, `Badge`, `EdgeLayer`, `KindIcon` are exported
for composition, but `Diagram` is the intended surface.

Accessibility: cards are `button` when `onNodeClick` is set, else
`div role="group"`; both carry `aria-label` from label + subtitle. The
container has `role="figure"` with `aria-label={doc.title}` and a
visually-hidden list of edges ("Kafka ingest → Raw lake, queue").

## 4. Theme

`theme.css` is a Tailwind v4 `@theme` block. Tokens are the sys layer;
components consume them through utilities (`bg-lens-card`,
`border-lens-card-border`, `stroke-lens-positive`, `text-lens-muted`).

```css
@theme {
  --color-lens-bg: #ffffff;
  --color-lens-dot: #d8dee4;
  --color-lens-lane: #f6f8fa;
  --color-lens-card: #ffffff;
  --color-lens-card-border: #d0d7de;
  --color-lens-fg: #1f2328;
  --color-lens-muted: #656d76;
  --color-lens-chip: #eaeef2;
  --color-lens-edge: #8c959f;
  --color-lens-pill: #ffffff;
  --color-lens-pill-border: #d0d7de;
  --color-lens-shadow: rgb(31 35 40 / 0.12);

  --color-lens-positive: #1f883d;
  --color-lens-positive-fill: #b9f0c4;
  --color-lens-positive-text: #116329;
  --color-lens-positive-border: rgb(31 136 61 / 0.55);
  /* caution (amber) and critical (red) follow the same four-token shape */
}

.dark {
  /* every token above, from upstream's dark palette */
}
```

Defaults are upstream's palette so the look survives verbatim. Consumers
override tokens in their own `@theme` or `.dark` block.

Consumers must add `@source "../node_modules/@unpunnyfuns/lens";` so Tailwind
emits the utilities the components use. The README states this in the
install section; the example app does it.

## 5. Example app

`example/` — a Vite + React + Tailwind app, not published, run with
`npm run example`. It:

- Renders a hand-authored data-ingress document: lanes for external sources,
  ingestion, validation, storage, consumers; a mix of `compact` and `chart`
  cards; a few `animated` and `hero` edges; one `critical` deprecated feed.
- Fills chart cards with a small inline SVG sparkline fed by a fake ticking
  data source (no chart library — the point is to prove the slot, not pick a
  library).
- Has a light/dark toggle and a view selector for the document's drill-downs.
- Logs `onNodeClick` / `onEdgeClick` to a side panel.

The example imports the library from `src/` via a Vite alias, so changes show
without a build step.

## 6. Tooling and tests

- TypeScript strict, `verbatimModuleSyntax`, ESM only.
- oxlint + oxfmt.
- Build: `tsc` to `dist/`, `theme.css` copied alongside.
- Vitest 5. Two projects in one config:
  - `layout` — Node environment. Ports upstream's engine tests: determinism
    (same doc → same bytes of JSON), routing invariants, congestion, hostile
    inputs (dense, CJK, mixed kinds), plus new tests for explicit rows and
    `ROW_OVERFULL`.
  - `browser` — `@vitest/browser-playwright`, Chromium, with
    `vitest-browser-react`. Tests mount `Diagram` in a real browser: card
    count and positions match the atlas, edge paths exist, render-prop
    content lands inside the card body, `selected` dims the rest, clicks
    call back with ids, dark class flips token values (via
    `getComputedStyle`).
  - jsdom is not used anywhere.
- Scripts: `build`, `typecheck`, `lint`, `format`, `test`, `test:layout`,
  `test:browser`, `example`.

## Open questions

None blocking. Package name is a placeholder.
