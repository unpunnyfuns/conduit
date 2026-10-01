# detail — design

Date: 2026-10-01. Extends the conduit specs of 2026-09-08/09.

Node and edge details — the `summary` prose the schema already carries, plus connections — shown either in a library-placed popover anchored to the clicked element, or in an app-placed panel built from the same exported components.

## Goals

- `Diagram detail="popover"` opens an anchored detail on click; nothing else in the diagram changes.
- `NodeDetail` / `EdgeDetail` / `Popover` are exported so an app can place the same content anywhere.
- Content comes from the document only; apps append their own via `renderDetail`.
- Accessible: a dialog with a labelled title, focus moved in on open and restored on close, Escape and outside click close it.

## Non-goals

- Hover tooltips. Lane details. Animation. Editing.

## Components (`src/components/detail/`)

### `placePopover` (pure, `place.ts`)

```ts
type Size = { width: number; height: number }
const POPOVER_WIDTH = 280
const POPOVER_GAP = 12
const placePopover: (anchor: Box, size: Size, canvas: Size) => Box
```

Tries, in order: right of the anchor (`x = anchor.x + anchor.width + gap`, `y = anchor.y`) if it fits in the canvas width; else left (`x = anchor.x − gap − width`) if `x ≥ 0`; else below (`x = anchor.x`, `y = anchor.y + anchor.height + gap`). Then clamps `x` into `[0, canvas.width − width]` and `y` into `[0, canvas.height − height]` (a popover taller than the canvas clamps to 0). Exported from the package root.

### `Popover`

```tsx
<Popover anchor={Box} canvas={Size} labelledBy={string} onClose={() => void}>{children}</Popover>
```

Absolutely positioned inside the canvas (so it scrolls and scales with the diagram), width `POPOVER_WIDTH`, surface `bg-conduit-card border-conduit-card-border rounded-[10px] shadow-[0_4px_12px_var(--color-conduit-shadow)]`, padding 14px, `z-10`. Height is measured after mount (`useLayoutEffect` + `offsetHeight`) and the box recomputed with `placePopover`; until measured it renders with `visibility: hidden` at the right-of-anchor position. `role="dialog"`, `aria-labelledby={labelledBy}`, `tabIndex={-1}`; on open it stores `document.activeElement` and focuses itself; on unmount it restores that focus. Document listeners while open: `keydown` Escape → `onClose()`; `mousedown` outside the popover and outside any `[data-conduit-node]` / `[data-edge-hit]` → `onClose()` (clicks on cards/edges are left to the diagram, which switches the detail instead). Carries `data-conduit-popover`.

### `NodeDetail`

```tsx
<NodeDetail node={ConduitNode} edges={readonly Edge[]} labelOf={(id) => string} titleId={string} onSelect?={(id) => void}>{children?}</NodeDetail>
```

Renders: header row (`KindIcon` chip + `label` as `<h3 id={titleId}>` + `subtitle` mono), the node's `badges`, `summary` as a paragraph (omitted when absent), then two lists computed from `edges`: **Receives from** (edges with `to === node.id`, as `labelOf(edge.from)` + `edge.label`/`kind`) and **Sends to** (`from === node.id`), each omitted when empty; self-loops appear in neither. Entries are `<button>`s calling `onSelect(nodeId)` when given, plain text otherwise. `children` renders last.

### `EdgeDetail`

```tsx
<EdgeDetail edge={Edge} fromLabel={string} toLabel={string} titleId={string} state?={EdgeState}>{children?}</EdgeDetail>
```

Renders: `<h3 id={titleId}>` as `fromLabel → toLabel`; a line with `kind` and `label` (when present); `summary` paragraph; when `state` is given, a line `State: {level}` plus `rate` when present; `children` last.

## `Diagram`

New props:

```ts
detail?: "popover" | "none"                 // default "none"
detailFor?: string                          // controlled: node or edge id
onDetailChange?: (id: string | undefined) => void
renderDetail?: (target: DetailTarget) => ReactNode
type DetailTarget = { kind: "node"; node: ConduitNode } | { kind: "edge"; edge: Edge }
```

Behaviour with `detail="popover"`:
- Clicking a card or an edge (in addition to firing `onNodeClick` / `onEdgeClick`) opens its detail; clicking the open one closes it. `Diagram` always wires edge hit paths in this mode even when the app passes no `onEdgeClick`.
- Uncontrolled by default (internal state); when `detailFor` is provided it is the source of truth and `onDetailChange` is called with the id the diagram would have set. In either mode `onDetailChange` fires on every change.
- The popover's anchor is `atlas.nodes[id]`, or for an edge its pill box when it has a label, else `atlas.edges[id]`. Content is `NodeDetail` (with `onSelect` that switches the detail to the chosen neighbour and lights nothing) or `EdgeDetail` (with the edge's current `edgeState` entry), followed by `renderDetail(target)` when given.
- An id that is not in the current layout (scoped out by a view) shows nothing.
- `selected`/`highlight` are untouched — detail and selection are independent.

Exports: `NodeDetail`, `EdgeDetail`, `Popover`, `placePopover`, `POPOVER_WIDTH`, type `DetailTarget`.

## Example

`detail="popover"` on; `renderDetail` adds an "Owner: data-platform" line for nodes. `example/data/ingress.ts` gains a `summary` on every node and on the labelled edges.

## Tests

Node (`test/layout/place.test.ts`): right when it fits; flips left when it would overflow; falls below when neither side fits; clamps `y` at the bottom; clamps a too-tall popover to `y = 0`; never returns negative coordinates.

Browser (`test/browser/detail.test.tsx`):
- `NodeDetail` for `warehouse` on the ingress edges: heading "Warehouse", the summary text, "Receives from" lists `Raw lake`, "Sends to" lists `Analytics UI` and `Reporting job`; `onSelect` fires with `raw-lake`.
- `EdgeDetail` for `lake-to-warehouse`: heading "Raw lake → Warehouse", shows `data` and `dbt`, and `State: stale` when given.
- `Popover`: renders `role="dialog"` with the label; receives focus; Escape calls `onClose`; mousedown outside calls `onClose`; mousedown inside does not; unmount restores focus to the previously focused element.
- `Diagram detail="popover"`: clicking Warehouse opens a dialog named "Warehouse" positioned inside `[data-conduit-canvas]`; clicking it again closes; clicking the rightmost card (`analytics-ui`) places the popover left of it (popover `right ≤ card left`); works with `direction: "down"`; `renderDetail` content appears; clicking the `lake-to-warehouse` edge hit path opens the edge dialog without any `onEdgeClick` prop; controlled mode: `detailFor="warehouse"` opens it and a click calls `onDetailChange(undefined)` without closing.

README: a "Details" section with the props and the exported components. CLAUDE.md: one sentence.

## Open questions

None.
