# highlight — design

Date: 2026-09-08. Extends `2026-09-08-lens-design.md` and `2026-09-08-direction-design.md`.

Selecting a card can light the whole path back to its sources (or forward to its sinks), not only its immediate neighbours.

## Goals

- A `highlight` mode on `Diagram` decides what stays lit for a selection: `"neighbours"` (today), `"upstream"`, `"downstream"`, `"both"`.
- The traced path's edges are emphasised so the route reads as one line, not just as "not dimmed".
- The trace is a pure, exported helper so consumers can reuse it (e.g. a panel listing a card's sources).

## Non-goals

- Pulses on the traced path (deferred; a ten-line follow-up on `EdgeLayer`).
- Multi-seed path intersection, shortest paths, or weighting. A trace is the transitive closure over edges.
- Changing what `selected` means: selected cards keep the ring; tracing only changes what dims.

## Helper

`src/layout/trace.ts`, exported from `./layout` and the package root:

```ts
type Highlight = "neighbours" | "upstream" | "downstream" | "both"
type Trace = { nodes: Set<string>; edges: Set<string> }
const traceFrom: (edges: readonly Edge[], seeds: readonly string[], highlight: Highlight) => Trace
```

`seeds` are node ids and/or edge ids. Rules, identical for every mode:
- A seeded node is in `nodes`.
- A seeded edge id is in `edges` (it does not seed a trace).
- Self-loops (`from === to`) are never followed and are only lit when seeded directly or when their node is lit in `"neighbours"`.

Per mode:
- `"neighbours"`: `edges` also gets every edge with a seeded node at either end. `nodes` gets nothing more. (Exactly today's `Diagram` behaviour.)
- `"upstream"`: breadth-first from the seeded nodes following each edge from `to` to `from`; every edge walked and every node reached joins the sets. Visited set guards cycles.
- `"downstream"`: the same walk following `from` to `to`.
- `"both"`: the union of upstream and downstream.

Deterministic: walks iterate `edges` in array order; the returned sets' insertion order is therefore stable, though callers should not depend on it.

## Diagram

New prop `highlight?: Highlight` (default `"neighbours"`). `lit` is computed as: `trace = traceFrom(laid.edges.map(e => e.edge), selected, highlight)`; lit nodes are `trace.nodes` restricted to nodes in the layout; lit edges are `trace.edges` restricted likewise; lit lanes are selected lane ids plus lanes containing a lit node. When `highlight !== "neighbours"`, the lit edges are also passed to `EdgeLayer` as `emphasisedIds`; the layer draws them with the hero stroke weight (2.25) and glow, leaving pulse count unchanged. Edges the document already marks `hero` are unaffected. With no selection nothing dims and nothing is emphasised, as today.

## EdgeLayer

New prop `emphasisedIds?: ReadonlySet<string>` (default empty). `hero = edge.emphasis === "hero" || emphasisedIds.has(edge.id)` for stroke and glow only; the `Pulses` `hero` flag keeps reading `edge.emphasis`, so emphasis by selection never changes pulse count or timing. An edge the document marks `muted` is never emphasised by selection; the author's de-emphasis wins.

## Example

`example/App.tsx` gets a `highlight` `<select>` (four modes) defaulting to `"upstream"`, passed to `Diagram`. Clicking a card still toggles a single selection.

## Tests

`test/layout/trace.test.ts` (Node) on the `ingress` fixture: upstream of `warehouse` reaches exactly `raw-lake, pii-scrubber, schema-validator, kafka-ingest, batch-loader, partner-api, webhooks, sftp-drop` and their connecting edges, not `analytics-ui`, `reporting-job`, `legacy-ftp` or `warehouse-to-ui`; downstream of `kafka-ingest` reaches `schema-validator, pii-scrubber, raw-lake, warehouse, analytics-ui, reporting-job`; `"both"` is the union; `"neighbours"` matches the old rule; a seeded edge id lights only that edge; a synthetic cycle `a→b→a` terminates and lights both; a self-loop is not followed; unknown ids are ignored.

`test/browser/diagram.test.tsx`: `selected={["warehouse"]} highlight="upstream"` → `partner-api` card opacity 1 and `analytics-ui` dimmed; edge `partner-to-kafka` group opacity 1 with the main path's computed `stroke-width` 2.25px; `warehouse-to-ui` dimmed. The existing neighbours-mode dimming test is unchanged.

README: `highlight` row in the `Diagram` props table; `traceFrom` under "Layout without React".

## Open questions

None.
