# direction — design

Date: 2026-09-08. Extends `2026-09-08-lens-design.md` (the package is now `@unpunnyfuns/conduit`).

A per-document `direction` that draws lanes either as columns with cards flowing down (`"right"`, today's layout) or as horizontal bands with cards flowing left to right (`"down"`).

## Goals

- `direction: "down"` produces a transposed diagram with the same look, the same determinism guarantees, and no changes to components.
- The engine's router, seating, rank and congestion logic stay untouched; only the numbers they are fed change.
- `"right"` output is byte-identical to today's.

## Non-goals

- RTL layouts, per-lane direction, or a `Diagram` prop override. Direction is part of the drawing, like `row`.
- Different card shapes per direction. A card is 372 wide and its declared height tall in both.

## Schema

`ConduitDocument` gains `direction: z.enum(["right", "down"]).default("right")`. `Layout` gains `direction: Direction`. Nothing else in the contract changes. `row` keeps its meaning — the node's slot along the flow — which in `"down"` is a column index within its band.

## The frame

The engine works in an internal frame where lanes are columns along the x axis and rows go down the y axis. A `Frame` (new `src/layout/frame.ts`) supplies every number the layout currently reads from `design.ts` constants, derived from `direction` and the document's nodes:

```ts
type Direction = "right" | "down"

type Frame = {
  direction: Direction
  /** Width of every lane's content in frame x. */
  laneCross: number
  /** Padding inside a lane before/after content, frame x. */
  crossStart: number
  crossEnd: number
  /** Space inside a lane before the first row / after the last, frame y. */
  alongStart: number
  alongEnd: number
  /** Frame-y extent of a card. */
  along: (node: ConduitNode, heights: CardHeights) => number
  /** Frame-x extents of the cards in one row, left to right, summing (with gaps) to ≤ laneCross. */
  crossSplit: (row: SeatedRow, heights: CardHeights) => number[]
  /** Physical width of a corridor and of a band between rows, for congestion relief. */
  corridorWidth: number
  bandWidth: number
}
```

| | `"right"` (today) | `"down"` |
|---|---|---|
| `laneCross` | `LANE_CONTENT_WIDTH` (372) | max over every seated row of `sum(cardHeight) + CARD_GAP_X × (n−1)` |
| `crossStart` / `crossEnd` | `LANE_PADDING_X` / `LANE_PADDING_X` (16) | `LANE_HEADER_STRIP` (48) / `LANE_BOTTOM_PADDING` (20) |
| `alongStart` / `alongEnd` | `CONTENT_TOP − LANE_TOP` (48) / `LANE_BOTTOM_PADDING` (20) | `LANE_PADDING_X` / `LANE_PADDING_X` |
| `along(node)` | `cardHeight(node)` | `LANE_CONTENT_WIDTH` (372) |
| `crossSplit(row)` | equal halves of 372 for a pair, else `[372]` | each card's `cardHeight`, in row order |
| `corridorWidth` | `crossStart + crossEnd + LANE_GAP` | same formula with `"down"` paddings |
| `bandWidth` | `ROW_GAP` | `ROW_GAP` |

`LANE_HEADER_STRIP = 48` is a new constant in `design.ts` (it equals `CONTENT_TOP − LANE_TOP`; `"right"` reads that difference through the frame so the number lives in one place). `laneCross` for `"down"` is computed once per layout from seating, so every band is the same height — the same stability rule as today's constant lane width: adding a chart card never moves the bands below it, only makes all bands taller together.

## Engine changes

- `architecture.ts`: `layoutArchitecture(graph, heights, frame, expansions?)`. Replaces direct reads of `LANE_CONTENT_WIDTH`, `LANE_PADDING_X`, `CONTENT_TOP`/`LANE_TOP`, `LANE_BOTTOM_PADDING`, `cardHeight`, `rowWidths` with the frame's fields. Lane box in frame: x from `DIAGRAM_MARGIN`, width `crossStart + laneCross + crossEnd`; content starts at `x + crossStart`; rows start at `LANE_TOP + alongStart`; the lane's y extent ends `alongEnd` after the last row. `grid.corridors` are derived from `crossStart`/`crossEnd` and `LANE_GAP` as now.
- `congestion.ts`: `relieveCongestion(graph, heights, frame)`; `CORRIDOR_WIDTH` and the band width come from `frame.corridorWidth` / `frame.bandWidth`.
- `labels.ts`: `placeLabelPills(routed, swapped: boolean)`. When `swapped`, a pill's frame size is `{ width: PILL_HEIGHT, height: measured text width + padding }` so that after transposition it is text-shaped.
- `layout.ts`: builds the frame (`frameFor(doc.direction, seating-independent inputs)` — for `"down"` this needs the seated rows, so `frameFor` takes the `ScopedGraph` and runs `seatNodes` itself; `layoutArchitecture` seats again — seating is cheap and deterministic, and this keeps `layoutArchitecture` pure). After routing and pill placement, if `"down"`: transpose every lane box, node box, pill box and curve (swap x↔y, width↔height) with `transposeBox` / `transposeCurve` (new in `geometry.ts` / `edges.ts`). Then compute `drawn`, canvas and shift in screen space exactly as today. `Layout.direction` is set from the document.

`LANE_TOP` (44) stays the along-axis origin and `DIAGRAM_MARGIN` (16) the cross-axis origin in the frame for both directions; after transposition a `"down"` diagram therefore has a 44px left margin and a 16px top margin. Accepted — it keeps the frame identical and the difference is invisible in practice.

`seating.ts`, `rank.ts`, `edges.ts` (except the new `transposeCurve` helper), `scope.ts` — unchanged.

## Components

Unchanged. `LaneBand` already draws its header top-left with `top-[14px] left-[16px]`; in a band that sits inside the 48px header strip. `Card`, `EdgeLayer`, `Diagram` consume screen-space boxes and paths. Arrowheads use `orient="auto-start-reverse"`, pulses follow the path.

## Example

`example/App.tsx` gets a Right / Down toggle next to Fit; it passes `{ ...ingress, direction }` to `Diagram`. `ingress.ts` is unchanged.

## Tests

`test/layout/direction.test.ts`:
- `"right"` layout of `ingress` is byte-identical (`JSON.stringify`) to the layout of the same document with `direction` omitted, and to a snapshot of the pre-change output for its node boxes (captured once in the test as literal x/y for three nodes, so a regression in the frame refactor is caught).
- For `"down"`: every band has the same height; bands are ordered by `lane.order` top to bottom; within a band, cards with increasing `row` have increasing x; a pair (two nodes with the same `row`) stacks vertically with `CARD_GAP_X` between; every node box is 372 wide and `cardHeight` tall.
- `"down"` determinism, pill non-intersection, and canvas containment, mirroring the `"right"` tests.
- Transposition round trip: for `"down"`, each node's frame box (recovered by swapping the screen box back) equals the box `layoutArchitecture` produced in the frame — proven by exporting the frame layout from `layout()` under a test-only helper, or more simply by asserting `layout(down).atlas.nodes[id]` has `width === 372` and `height === cardHeight(node)` for every node, and lanes have `height === frame.laneCross + crossStart + crossEnd`.

`test/browser/diagram.test.tsx`: one test rendering `{ ...ingress, direction: "down" }` — lane bands' `getBoundingClientRect().top` increase in `order`, and within the `ingest` band the `kafka-ingest` card is left of `batch-loader`.

README: a `direction` row in the document type block and one sentence.

## Open questions

None.
