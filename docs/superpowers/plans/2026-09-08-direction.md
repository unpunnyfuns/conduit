# direction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `direction: "right" | "down"` to conduit documents so lanes can be drawn as horizontal bands with cards flowing left→right, with `"right"` output byte-identical to today.

**Architecture:** A `Frame` (new `src/layout/frame.ts`) supplies every number `architecture.ts` and `congestion.ts` currently read from constants — lane cross-size, paddings, card along/cross sizes, gap widths — derived from the direction. The engine keeps laying out "columns with rows going down" in its own frame; for `"down"`, `layout()` transposes every box and curve to screen space after routing and pill placement, then computes the canvas as it does today. Components are untouched.

**Tech Stack:** unchanged — TypeScript, zod 4, Vitest 5 (Node + Chromium projects), React 19, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-08-direction-design.md`

## Global Constraints

- Every import inside `src/`, `test/`, `example/` uses an explicit `.js` extension. Functional style; no classes. No inline end-of-line comments.
- Deterministic: no clock/random/DOM; ties by array index.
- `"right"` (and a document with `direction` omitted) must produce output byte-identical to the current `main` — every existing test stays green unchanged, and Task 3 adds a literal-box guard.
- `seating.ts`, `rank.ts`, `scope.ts`, and all of `edges.ts` except one new exported helper stay unchanged. Components (`src/components/**`) stay unchanged.
- Card size in both directions: 372 wide (`LANE_CONTENT_WIDTH`) × declared height, except `"right"` pairs which split 372 in half as today.
- New constant `LANE_HEADER_STRIP = 48` in `design.ts`; `CONTENT_TOP` stays exported (it equals `LANE_TOP + LANE_HEADER_STRIP`; add that as its definition).
- Full check before each commit: `npm run lint && npm run format && npm run typecheck && npm test`. Commit as `unpunnyfuns` (repo config is set).

## File Structure

```
src/schema/document.ts        + direction field
src/layout/design.ts          + LANE_HEADER_STRIP; CONTENT_TOP defined from it
src/layout/frame.ts           NEW: Direction, Frame, frameFor()
src/layout/architecture.ts    reads sizes from Frame; exports orderLanes
src/layout/congestion.ts      gap widths from Frame
src/layout/labels.ts          placeLabelPills(routed, swapped)
src/layout/geometry.ts        + transposeBox
src/layout/edges.ts           + transposeCurve
src/layout/layout.ts          frame + transposition; Layout.direction
src/layout.ts                 + export type Direction
example/App.tsx               Right/Down toggle
README.md, CLAUDE.md          direction docs
test/schema/parse.test.ts     direction default/validation
test/layout/frame.test.ts     NEW
test/layout/direction.test.ts NEW
test/browser/diagram.test.tsx + one "down" test
```

---

### Task 1: Schema `direction`

**Files:**
- Modify: `src/schema/document.ts` (the `ConduitDocument` object, ~line 107)
- Modify: `src/schema/primitives.ts` (add `Direction`)
- Modify: `src/index.ts` (export `Direction` type)
- Test: `test/schema/parse.test.ts`

**Interfaces:**
- Produces: `Direction = "right" | "down"` (zod enum + type) from `src/schema/primitives.js`; `ConduitDocument.direction: Direction` (default `"right"`).

- [ ] **Step 1: Write the failing tests** — append to `test/schema/parse.test.ts` inside the existing `describe("parseDocument")`:

```ts
  it("defaults direction to right", () => {
    expect(parseDocument(minimal).direction).toBe("right");
  });

  it("accepts direction down", () => {
    expect(parseDocument({ ...minimal, direction: "down" }).direction).toBe("down");
  });

  it("rejects an unknown direction", () => {
    expect(() => parseDocument({ ...minimal, direction: "up" })).toThrow(ConduitDocumentError);
  });
```

- [ ] **Step 2: Run** `npx vitest run test/schema` — expect 3 failures (`direction` undefined / unknown key rejected).

- [ ] **Step 3: Implement.** In `src/schema/primitives.ts` add:

```ts
/** Which way the flow runs: lanes as columns with rows going down, or lanes as bands with columns going right. */
export const Direction = z.enum(["right", "down"]);
export type Direction = z.infer<typeof Direction>;
```

In `src/schema/document.ts` import `Direction` from `./primitives.js` and add to `ConduitDocument` after `summary`:

```ts
  direction: Direction.default("right"),
```

In `src/index.ts`, add `Direction` to the type export list from `./schema/primitives.js`.

- [ ] **Step 4: Run** `npm run lint && npm run format && npm run typecheck && npm test` — all green (the fixture `ingress` gains `direction: "right"` through the default; nothing else reads it yet).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "Add direction to the document schema"`.

---

### Task 2: `Frame`

**Files:**
- Modify: `src/layout/design.ts`
- Create: `src/layout/frame.ts`
- Modify: `src/layout/architecture.ts` (export `orderLanes` only — no other change in this task)
- Test: `test/layout/frame.test.ts`

**Interfaces:**
- Consumes: `cardHeight(node, heights)`, `orderLanes(lanes)` from `architecture.js`; `seatNodes` from `seating.js`; `SeatedRow`.
- Produces (from `frame.ts`):
  ```ts
  type Frame = {
    direction: Direction
    laneCross: number
    crossStart: number; crossEnd: number
    /** The part of crossStart a route may use, measured from the lane's edge. */
    crossStartRoutable: number
    alongStart: number; alongEnd: number
    along: (node: ConduitNode) => number
    crossSplit: (row: SeatedRow) => number[]
    corridorWidth: number
    bandWidth: number
  }
  const frameFor: (direction: Direction, graph: ScopedGraph, heights: CardHeights) => Frame
  ```

- [ ] **Step 1: Add constants.** In `src/layout/design.ts` replace `export const CONTENT_TOP = 92;` with:

```ts
/** Room at the top of a lane for its header, before the first row. */
export const LANE_HEADER_STRIP = 48;
export const CONTENT_TOP = LANE_TOP + LANE_HEADER_STRIP;
```

(`LANE_TOP` is declared above it, so this evaluates to 92.)

- [ ] **Step 2: Export `orderLanes`** in `src/layout/architecture.ts`: change `const orderLanes =` to `export const orderLanes =`.

- [ ] **Step 3: Write the failing tests** — `test/layout/frame.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseDocument } from "../../src/index.js";
import {
  CARD_GAP_X,
  DEFAULT_CARD_HEIGHTS,
  LANE_BOTTOM_PADDING,
  LANE_CONTENT_WIDTH,
  LANE_GAP,
  LANE_HEADER_STRIP,
  LANE_PADDING_X,
  ROW_GAP,
} from "../../src/layout/design.js";
import { frameFor } from "../../src/layout/frame.js";

const doc = parseDocument({
  version: 1,
  title: "T",
  lanes: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
  nodes: [
    { id: "n1", label: "N1", kind: "service", lane: "a", row: 0 },
    { id: "n2", label: "N2", kind: "service", lane: "a", row: 0, subtitle: "s" },
    { id: "chart", label: "C", kind: "queue", lane: "b", row: 0, size: "chart" },
    { id: "big", label: "B", kind: "queue", lane: "b", row: 1, size: 200 },
  ],
});
const graph = { lanes: doc.lanes, nodes: doc.nodes, edges: doc.edges };
const heights = DEFAULT_CARD_HEIGHTS;

describe("frameFor right", () => {
  const frame = frameFor("right", graph, heights);

  it("uses the constant lane width and today's paddings", () => {
    expect(frame.laneCross).toBe(LANE_CONTENT_WIDTH);
    expect([frame.crossStart, frame.crossEnd]).toEqual([LANE_PADDING_X, LANE_PADDING_X]);
    expect(frame.crossStartRoutable).toBe(LANE_PADDING_X);
    expect([frame.alongStart, frame.alongEnd]).toEqual([LANE_HEADER_STRIP, LANE_BOTTOM_PADDING]);
    expect(frame.corridorWidth).toBe(LANE_PADDING_X * 2 + LANE_GAP);
    expect(frame.bandWidth).toBe(ROW_GAP);
  });

  it("runs the declared height along the flow and splits a pair in half", () => {
    const [n1, n2, chart, big] = doc.nodes;
    expect(frame.along(n1!)).toBe(heights.compact);
    expect(frame.along(n2!)).toBe(heights.withSubtitle);
    expect(frame.along(chart!)).toBe(heights.chart);
    expect(frame.along(big!)).toBe(200);
    const half = Math.round((LANE_CONTENT_WIDTH - CARD_GAP_X) / 2);
    expect(frame.crossSplit({ grid: 0, nodes: [n1!, n2!] })).toEqual([half, LANE_CONTENT_WIDTH - CARD_GAP_X - half]);
    expect(frame.crossSplit({ grid: 0, nodes: [chart!] })).toEqual([LANE_CONTENT_WIDTH]);
  });
});

describe("frameFor down", () => {
  const frame = frameFor("down", graph, heights);

  it("runs 372 along the flow and the declared height across it", () => {
    const [n1, n2, , big] = doc.nodes;
    expect(frame.along(n1!)).toBe(LANE_CONTENT_WIDTH);
    expect(frame.along(big!)).toBe(LANE_CONTENT_WIDTH);
    expect(frame.crossSplit({ grid: 0, nodes: [n1!, n2!] })).toEqual([heights.compact, heights.withSubtitle]);
  });

  it("makes every band tall enough for the tallest stacked row", () => {
    expect(frame.laneCross).toBe(200);
  });

  it("stacks a pair's heights when that is the tallest row", () => {
    const pairDoc = parseDocument({
      version: 1,
      title: "T",
      lanes: [{ id: "a", label: "A" }],
      nodes: [
        { id: "p", label: "P", kind: "service", lane: "a", row: 0, size: "chart" },
        { id: "q", label: "Q", kind: "service", lane: "a", row: 0, size: "chart" },
      ],
    });
    const pairFrame = frameFor("down", { lanes: pairDoc.lanes, nodes: pairDoc.nodes, edges: [] }, heights);
    expect(pairFrame.laneCross).toBe(heights.chart * 2 + CARD_GAP_X);
  });

  it("swaps the paddings and keeps only the lower part of the header strip routable", () => {
    expect([frame.crossStart, frame.crossEnd]).toEqual([LANE_HEADER_STRIP, LANE_BOTTOM_PADDING]);
    expect(frame.crossStartRoutable).toBe(LANE_PADDING_X);
    expect([frame.alongStart, frame.alongEnd]).toEqual([LANE_PADDING_X, LANE_PADDING_X]);
    expect(frame.corridorWidth).toBe(LANE_BOTTOM_PADDING + LANE_GAP + LANE_PADDING_X);
    expect(frame.bandWidth).toBe(ROW_GAP);
  });

  it("never lets a band be shorter than a compact card", () => {
    const tiny = parseDocument({
      version: 1,
      title: "T",
      lanes: [{ id: "a", label: "A" }],
      nodes: [{ id: "n", label: "N", kind: "service", lane: "a" }],
    });
    expect(frameFor("down", { lanes: tiny.lanes, nodes: tiny.nodes, edges: [] }, heights).laneCross).toBe(heights.compact);
  });
});
```

- [ ] **Step 4: Run** `npx vitest run test/layout/frame.test.ts` — FAIL, module not found.

- [ ] **Step 5: Write `src/layout/frame.ts`**

```ts
import type { ConduitNode } from "../schema/document.js";
import type { Direction } from "../schema/primitives.js";
import { cardHeight, orderLanes } from "./architecture.js";
import {
  CARD_GAP_X,
  LANE_BOTTOM_PADDING,
  LANE_CONTENT_WIDTH,
  LANE_GAP,
  LANE_HEADER_STRIP,
  LANE_PADDING_X,
  ROW_GAP,
  type CardHeights,
} from "./design.js";
import type { ScopedGraph } from "./scope.js";
import { seatNodes, type SeatedRow } from "./seating.js";

/**
 * The numbers the engine lays out with, for one direction.
 *
 * The engine always thinks in its own frame: lanes are columns along x, rows
 * go down y. "Cross" is x in that frame — across the lane — and "along" is y,
 * the direction the flow runs. A frame for `"down"` hands the engine the
 * transposed numbers; `layout()` swaps the axes back afterwards.
 */
export type Frame = {
  direction: Direction;
  /** Width of every lane's content, frame x. Constant across lanes so nothing shifts its neighbour. */
  laneCross: number;
  /** Padding inside a lane before and after its content, frame x. */
  crossStart: number;
  crossEnd: number;
  /** How much of `crossStart`, measured from the lane's edge, a route may run through. */
  crossStartRoutable: number;
  /** Room inside a lane before the first row and after the last, frame y. */
  alongStart: number;
  alongEnd: number;
  /** Frame-y extent of a card. */
  along: (node: ConduitNode) => number;
  /** Frame-x extents of one row's cards, in row order, summing with gaps to at most `laneCross`. */
  crossSplit: (row: SeatedRow) => number[];
  /** Physical width of a corridor between lanes and of a band between rows, for congestion relief. */
  corridorWidth: number;
  bandWidth: number;
};

const halves = (contentWidth: number): number[] => {
  const half = Math.round((contentWidth - CARD_GAP_X) / 2);
  return [half, contentWidth - CARD_GAP_X - half];
};

/**
 * The tallest stack of cards any row holds, so every band can be the same
 * height. Never shorter than a compact card, so an empty-looking band still
 * reads as a lane.
 */
const tallestRow = (graph: ScopedGraph, heights: CardHeights): number => {
  const seating = seatNodes(orderLanes(graph.lanes), graph.nodes, graph.edges);
  let tallest = heights.compact;
  for (const rows of seating.rowsByLane.values())
    for (const row of rows) {
      const stacked =
        row.nodes.reduce((sum, node) => sum + cardHeight(node, heights), 0) +
        CARD_GAP_X * (row.nodes.length - 1);
      tallest = Math.max(tallest, stacked);
    }
  return tallest;
};

export const frameFor = (direction: Direction, graph: ScopedGraph, heights: CardHeights): Frame => {
  switch (direction) {
    case "right":
      return {
        direction,
        laneCross: LANE_CONTENT_WIDTH,
        crossStart: LANE_PADDING_X,
        crossEnd: LANE_PADDING_X,
        crossStartRoutable: LANE_PADDING_X,
        alongStart: LANE_HEADER_STRIP,
        alongEnd: LANE_BOTTOM_PADDING,
        along: (node) => cardHeight(node, heights),
        crossSplit: (row) => (row.nodes.length < 2 ? [LANE_CONTENT_WIDTH] : halves(LANE_CONTENT_WIDTH)),
        corridorWidth: LANE_PADDING_X + LANE_GAP + LANE_PADDING_X,
        bandWidth: ROW_GAP,
      };
    case "down":
      return {
        direction,
        laneCross: tallestRow(graph, heights),
        crossStart: LANE_HEADER_STRIP,
        crossEnd: LANE_BOTTOM_PADDING,
        crossStartRoutable: LANE_PADDING_X,
        alongStart: LANE_PADDING_X,
        alongEnd: LANE_PADDING_X,
        along: () => LANE_CONTENT_WIDTH,
        crossSplit: (row) => row.nodes.map((node) => cardHeight(node, heights)),
        corridorWidth: LANE_BOTTOM_PADDING + LANE_GAP + LANE_PADDING_X,
        bandWidth: ROW_GAP,
      };
  }
};
```

`crossStartRoutable` exists so `"down"` routes stay out of the band's header text: only the bottom 16px of the 48px strip is corridor.

- [ ] **Step 6: Run** `npm run lint && npm run format && npm run typecheck && npm test` — green (frame.ts is not used by the engine yet; `architecture.ts`↔`frame.ts` import cycle is type-only on one side and value on the other — if `tsc` or vitest complains about the cycle, move `cardHeight` and `orderLanes` into a new `src/layout/lanes.ts` imported by both, and note it in the report).

- [ ] **Step 7: Commit** — `git commit -am "Add layout Frame"` (plus `git add src/layout/frame.ts test/layout/frame.test.ts`).

---

### Task 3: Engine reads the frame (`"right"` byte-identical)

**Files:**
- Modify: `src/layout/architecture.ts`, `src/layout/congestion.ts`, `src/layout/layout.ts`
- Test: `test/layout/direction.test.ts` (created here with the identity guard; Task 4 extends it)

**Interfaces:**
- Consumes: `Frame`, `frameFor` (Task 2).
- Produces: `layoutArchitecture(graph, frame, expansions?)` — note `heights` is no longer a parameter: card sizes come from the frame. `relieveCongestion(graph, frame)`. `layout()` unchanged externally in this task.

- [ ] **Step 1: Capture today's geometry as literals.** Before changing any engine file, run:

```bash
node --input-type=module -e "
import { layout } from './src/layout/layout.ts';
" 2>/dev/null || npx tsx -e "
import { layout } from './src/layout/layout.js';
import { ingress } from './example/data/ingress.js';
const l = layout(ingress);
for (const id of ['partner-api','kafka-ingest','warehouse','legacy-ftp']) console.log(id, JSON.stringify(l.atlas.nodes[id]));
console.log('lane store', JSON.stringify(l.atlas.lanes['store']));
console.log('size', l.width, l.height);
console.log('edge lake-to-warehouse', JSON.stringify(l.edges.find(e => e.edge.id === 'lake-to-warehouse')?.path));
"
```

(`tsx` is not installed; `npm i -D tsx` is acceptable, or write a temporary `test/layout/_capture.test.ts` that `console.log`s the same values under `npx vitest run` and delete it after copying.) Paste the printed values into the test below.

- [ ] **Step 2: Write the identity guard** — `test/layout/direction.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ingress } from "../../example/data/ingress.js";
import { layout } from "../../src/layout.js";

/**
 * Literal geometry captured from main before the frame refactor. If any of
 * these move, `"right"` is no longer byte-identical to what shipped.
 */
const CAPTURED = {
  nodes: {
    "partner-api": { x: 0, y: 0, width: 0, height: 0 },
    "kafka-ingest": { x: 0, y: 0, width: 0, height: 0 },
    warehouse: { x: 0, y: 0, width: 0, height: 0 },
    "legacy-ftp": { x: 0, y: 0, width: 0, height: 0 },
  },
  lane: { store: { x: 0, y: 0, width: 0, height: 0 } },
  size: { width: 0, height: 0 },
  path: "",
};

describe("direction right is today's layout", () => {
  const laid = layout(ingress);

  it("places the captured nodes exactly where they were", () => {
    for (const [id, box] of Object.entries(CAPTURED.nodes)) expect(laid.atlas.nodes[id], id).toEqual(box);
  });

  it("places the captured lane and canvas exactly", () => {
    expect(laid.atlas.lanes["store"]).toEqual(CAPTURED.lane.store);
    expect([laid.width, laid.height]).toEqual([CAPTURED.size.width, CAPTURED.size.height]);
  });

  it("routes the captured edge exactly", () => {
    expect(laid.edges.find(({ edge }) => edge.id === "lake-to-warehouse")?.path).toBe(CAPTURED.path);
  });

  it("is what an omitted direction means", () => {
    const { direction: _omitted, ...rest } = ingress;
    expect(JSON.stringify(layout({ ...rest, direction: "right" }))).toBe(JSON.stringify(laid));
  });
});
```

Replace every `0` and the empty `path` with the captured values. Run `npx vitest run test/layout/direction.test.ts` — must PASS against the unchanged engine before you touch it.

- [ ] **Step 3: Rewrite `src/layout/architecture.ts`** — replace the whole file:

```ts
import type { Lane, ConduitNode } from "../schema/document.js";
import { CARD_GAP_X, DIAGRAM_MARGIN, LANE_GAP, LANE_TOP, ROW_GAP, type CardHeights } from "./design.js";
import type { Frame } from "./frame.js";
import type { Box } from "./geometry.js";
import type { ScopedGraph } from "./scope.js";
import { seatNodes } from "./seating.js";

export type PlacedNode = {
  node: ConduitNode;
  box: Box;
  row: number;
  laneIndex: number;
};

export type PlacedLane = { lane: Lane; box: Box };

/**
 * The gaps of the grid, for the router: the vertical corridors beside each
 * lane's cards and the horizontal extents of every row. Corridor `i` runs to
 * the left of lane `i`; one extra corridor sits after the last lane.
 */
export type LayoutGrid = {
  rows: { top: number; height: number }[];
  corridors: { left: number; right: number }[];
  /** Where lane content ends — the floor of the last band under the last row. */
  laneBottom: number;
};

/**
 * Extra room granted to individual gaps, keyed by corridor or band index —
 * how the layout widens where traffic would otherwise compress track pitch
 * through the floor. Expanding a corridor moves every lane after it sideways
 * by the same amount; expanding a band moves every row after it down. Cards
 * travel with their lane and row — nothing re-seats, nothing reorders.
 */
export type GapExpansions = {
  corridors: ReadonlyMap<number, number>;
  bands: ReadonlyMap<number, number>;
};

export type ArchitectureLayout = {
  width: number;
  height: number;
  lanes: PlacedLane[];
  nodes: PlacedNode[];
  grid: LayoutGrid;
};

export const cardHeight = (node: ConduitNode, heights: CardHeights): number => {
  if (typeof node.size === "number") return node.size;
  if (node.size === "chart") return heights.chart;
  return node.subtitle === undefined ? heights.compact : heights.withSubtitle;
};

export const orderLanes = (lanes: readonly Lane[]): Lane[] =>
  lanes
    .map((lane, index) => ({ lane, index }))
    .sort(
      (a, b) =>
        (a.lane.order ?? Number.MAX_SAFE_INTEGER) - (b.lane.order ?? Number.MAX_SAFE_INTEGER) ||
        a.index - b.index,
    )
    .map(({ lane }) => lane);

/**
 * Lanes as columns along x, rows going down y — always. Which screen axis
 * each of those becomes is the frame's business, and `layout()` transposes
 * afterwards when the document flows the other way.
 */
export const layoutArchitecture = (
  graph: ScopedGraph,
  frame: Frame,
  expansions?: GapExpansions,
): ArchitectureLayout => {
  const corridorExtra = (index: number): number => expansions?.corridors.get(index) ?? 0;
  const bandExtra = (index: number): number => expansions?.bands.get(index) ?? 0;

  const ordered = orderLanes(graph.lanes);
  const seating = seatNodes(ordered, graph.nodes, graph.edges);

  const lanes = ordered.flatMap((lane) => {
    const rows = seating.rowsByLane.get(lane.id);
    return rows === undefined ? [] : [{ lane, rows }];
  });

  const laneBoxWidth = frame.crossStart + frame.laneCross + frame.crossEnd;
  const contentTop = LANE_TOP + frame.alongStart;

  const gridHeights = new Map<number, number>();
  for (const { rows } of lanes)
    for (const { grid, nodes } of rows) {
      const height = Math.max(...nodes.map((node) => frame.along(node)));
      gridHeights.set(grid, Math.max(gridHeights.get(grid) ?? 0, height));
    }

  const gridRows: { top: number; height: number }[] = [];
  let cursor = contentTop;
  for (let grid = 0; grid < seating.rowCount; grid += 1) {
    if (grid > 0) cursor += bandExtra(grid);
    const height = gridHeights.get(grid) ?? 0;
    gridRows.push({ top: cursor, height });
    cursor += height + ROW_GAP;
  }
  const contentBottom = cursor - ROW_GAP;

  const laneBottom = contentBottom + frame.alongEnd + bandExtra(seating.rowCount);
  const placedLanes: PlacedLane[] = [];
  const placedNodes: PlacedNode[] = [];
  let laneX = DIAGRAM_MARGIN;

  lanes.forEach(({ lane, rows }, laneIndex) => {
    laneX += corridorExtra(laneIndex);
    const contentX = laneX + frame.crossStart;

    placedLanes.push({
      lane,
      box: { x: laneX, y: LANE_TOP, width: laneBoxWidth, height: laneBottom - LANE_TOP },
    });

    for (const row of rows) {
      const top = gridRows[row.grid]?.top ?? contentTop;
      const widths = frame.crossSplit(row);

      let x = contentX;
      row.nodes.forEach((node, index) => {
        const width = widths[index] ?? frame.laneCross;
        placedNodes.push({
          node,
          box: { x, y: top, width, height: frame.along(node) },
          row: row.grid,
          laneIndex,
        });
        x += width + CARD_GAP_X;
      });
    }

    laneX += laneBoxWidth + LANE_GAP;
  });

  const corridors = placedLanes.map(({ box }, index) => ({
    left: box.x - LANE_GAP - frame.crossEnd - corridorExtra(index),
    right: box.x + frame.crossStartRoutable,
  }));
  const lastContentRight =
    (placedLanes[placedLanes.length - 1]?.box.x ?? DIAGRAM_MARGIN) + frame.crossStart + frame.laneCross;
  corridors.push({
    left: lastContentRight,
    right: lastContentRight + frame.crossEnd + LANE_GAP + frame.crossStartRoutable + corridorExtra(placedLanes.length),
  });

  return {
    width: Math.ceil(laneX - LANE_GAP + DIAGRAM_MARGIN),
    height: Math.ceil(laneBottom + DIAGRAM_MARGIN),
    lanes: placedLanes,
    nodes: placedNodes,
    grid: { rows: gridRows, corridors, laneBottom },
  };
};
```

Sanity of the corridor formula against today's numbers for `"right"`: corridor 0 `left = 16 − 20 − 16 = −20`, `right = 16 + 16 = 32` — identical to the old `box.x + LANE_PADDING_X − gutter` / `box.x + LANE_PADDING_X`. Last corridor `right = lastContentRight + 16 + 20 + 16` = old `+ gutter`.

- [ ] **Step 4: Update `src/layout/congestion.ts`.** Replace the import block and signature, and the two width reads:

```ts
import { TRACK_CLEARANCE, TRACK_PITCH_MIN } from "./design.js";
import type { Frame } from "./frame.js";
import type { ScopedGraph } from "./scope.js";
import {
  layoutArchitecture,
  type ArchitectureLayout,
  type GapExpansions,
  type LayoutGrid,
} from "./architecture.js";
import { channelTraffic, routeEdges, type ChannelTraffic, type RoutedEdge } from "./edges.js";
```

`relieveCongestion = (graph: ScopedGraph, frame: Frame)`; both `layoutArchitecture(graph, heights, expansions)` calls become `layoutArchitecture(graph, frame, expansions)`; `expansionsFor(channelTraffic(graph.edges, layout), layout.grid)` becomes `expansionsFor(channelTraffic(graph.edges, layout), layout.grid, frame)`. Delete `const CORRIDOR_WIDTH = …`. `expansionsFor` gains a third parameter `frame: Frame` and uses `frame.corridorWidth` where `CORRIDOR_WIDTH` was, and for bands:

```ts
    const width = index === grid.rows.length ? frame.alongEnd : frame.bandWidth;
```

- [ ] **Step 5: Update `src/layout/layout.ts`** — add `import { frameFor } from "./frame.js";` and in `layout()` replace

```ts
  const { layout: placed, routed } = relieveCongestion(graph, heights);
```
with
```ts
  const frame = frameFor(doc.direction, graph, heights);
  const { layout: placed, routed } = relieveCongestion(graph, frame);
```

- [ ] **Step 6: Fix callers in tests.** `test/layout/architecture.test.ts`, `routing.test.ts`, `congestion.test.ts` call `layoutArchitecture(graph, DEFAULT_CARD_HEIGHTS)` / `relieveCongestion(graph, DEFAULT_CARD_HEIGHTS)`. Change each to pass `frameFor("right", graph, DEFAULT_CARD_HEIGHTS)` (import `frameFor` from `../../src/layout/frame.js`). Where a test builds a custom heights object (`{ ...DEFAULT_CARD_HEIGHTS, chart: 300 }`), pass it to `frameFor` instead. Do not change any assertion.

- [ ] **Step 7: Run** `npm run lint && npm run format && npm run typecheck && npm test` — all green including the identity guard. If the guard fails, the frame numbers diverge from the old constants: compare `frameFor("right")` field by field against the old code before touching anything else.

- [ ] **Step 8: Commit** — `git add -A && git commit -m "Lay out through a Frame; right is byte-identical"`.

---

### Task 4: `"down"` — transposition

**Files:**
- Modify: `src/layout/geometry.ts`, `src/layout/edges.ts` (one helper each), `src/layout/labels.ts`, `src/layout/layout.ts`, `src/layout.ts`
- Test: `test/layout/direction.test.ts` (extend)

**Interfaces:**
- Produces: `transposeBox(box): Box` (geometry), `transposeCurve(curve): Curve` (edges), `placeLabelPills(routed, swapped: boolean)`, `Layout.direction: Direction`, `export type { Direction }` from `src/layout.ts`.

- [ ] **Step 1: Write the failing tests** — append to `test/layout/direction.test.ts`:

```ts
import { CARD_GAP_X, DEFAULT_CARD_HEIGHTS, LANE_BOTTOM_PADDING, LANE_CONTENT_WIDTH, LANE_HEADER_STRIP } from "../../src/layout/design.js";
import { cardHeight } from "../../src/layout/architecture.js";
import { frameFor } from "../../src/layout/frame.js";
import { parseDocument } from "../../src/index.js";

const down = { ...ingress, direction: "down" as const };

describe("direction down", () => {
  const laid = layout(down);
  const laneBox = (id: string) => laid.atlas.lanes[id]!;
  const nodeBox = (id: string) => laid.atlas.nodes[id]!;

  it("reports its direction", () => {
    expect(laid.direction).toBe("down");
    expect(layout(ingress).direction).toBe("right");
  });

  it("stacks bands top to bottom in lane order, all the same height", () => {
    const ordered = ["sources", "ingest", "validate", "store", "consume"].map(laneBox);
    for (let i = 1; i < ordered.length; i += 1) expect(ordered[i]!.y).toBeGreaterThan(ordered[i - 1]!.y + ordered[i - 1]!.height - 1);
    expect(new Set(ordered.map((box) => box.height)).size).toBe(1);
    expect(new Set(ordered.map((box) => box.x)).size).toBe(1);
  });

  it("sizes a band from the tallest row plus header and bottom padding", () => {
    const frame = frameFor("down", { lanes: down.lanes, nodes: down.nodes, edges: down.edges }, DEFAULT_CARD_HEIGHTS);
    expect(laneBox("sources").height).toBe(LANE_HEADER_STRIP + frame.laneCross + LANE_BOTTOM_PADDING);
  });

  it("keeps every card 372 wide and its declared height tall", () => {
    for (const node of down.nodes) {
      expect(nodeBox(node.id).width, node.id).toBe(LANE_CONTENT_WIDTH);
      expect(nodeBox(node.id).height, node.id).toBe(cardHeight(node, DEFAULT_CARD_HEIGHTS));
    }
  });

  it("runs rows left to right inside a band", () => {
    expect(nodeBox("partner-api").x).toBeLessThan(nodeBox("sftp-drop").x);
    expect(nodeBox("sftp-drop").x).toBeLessThan(nodeBox("webhooks").x);
    expect(nodeBox("partner-api").y).toBe(nodeBox("sftp-drop").y);
  });

  it("keeps cards inside their band, below the header strip", () => {
    for (const { node, box } of laid.nodes) {
      const band = laneBox(node.lane);
      expect(box.y, node.id).toBeGreaterThanOrEqual(band.y + LANE_HEADER_STRIP);
      expect(box.y + box.height, node.id).toBeLessThanOrEqual(band.y + band.height - LANE_BOTTOM_PADDING);
      expect(box.x, node.id).toBeGreaterThanOrEqual(band.x);
      expect(box.x + box.width, node.id).toBeLessThanOrEqual(band.x + band.width);
    }
  });

  it("stacks a pair vertically with the card gap between", () => {
    const doc = parseDocument({
      version: 1,
      title: "P",
      direction: "down",
      lanes: [{ id: "a", label: "A" }],
      nodes: [
        { id: "p", label: "P", kind: "service", lane: "a", row: 0 },
        { id: "q", label: "Q", kind: "service", lane: "a", row: 0, size: "chart" },
      ],
    });
    const pair = layout(doc);
    const p = pair.atlas.nodes["p"]!;
    const q = pair.atlas.nodes["q"]!;
    expect(p.x).toBe(q.x);
    expect(q.y).toBe(p.y + p.height + CARD_GAP_X);
  });

  it("keeps everything inside the canvas", () => {
    const inside = (box: { x: number; y: number; width: number; height: number }) =>
      box.x >= 0 && box.y >= 0 && box.x + box.width <= laid.width && box.y + box.height <= laid.height;
    for (const { box } of laid.nodes) expect(inside(box)).toBe(true);
    for (const { box } of laid.lanes) expect(inside(box)).toBe(true);
    for (const box of Object.values(laid.atlas.edges)) expect(inside(box)).toBe(true);
  });

  it("gives every labelled edge a text-shaped pill and no two intersect", () => {
    const pills = laid.edges.flatMap(({ label }) => (label === undefined ? [] : [label.box]));
    expect(pills.length).toBe(down.edges.filter((edge) => edge.label !== undefined).length);
    for (const pill of pills) expect(pill.width).toBeGreaterThan(pill.height);
    pills.forEach((a, i) => {
      for (const b of pills.slice(i + 1)) {
        const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
        expect(apart).toBe(true);
      }
    });
  });

  it("is byte-identical across calls and JSON round trips", () => {
    expect(JSON.stringify(layout(parseDocument(JSON.parse(JSON.stringify(down)))))).toBe(JSON.stringify(laid));
  });

  it("does not move when a label is renamed", () => {
    const renamed = { ...down, nodes: down.nodes.map((node) => (node.id === "warehouse" ? { ...node, label: "W".repeat(120) } : node)) };
    expect(layout(renamed).atlas).toEqual(laid.atlas);
  });
});
```

(Move the new imports to the top of the file with the existing ones.)

- [ ] **Step 2: Run** `npx vitest run test/layout/direction.test.ts` — the `down` block fails (no `direction` on `Layout`, bands not stacked).

- [ ] **Step 3: Helpers.** In `src/layout/geometry.ts` append:

```ts
/** The same box with its axes swapped: what a frame box is on screen when the flow runs the other way. */
export const transposeBox = (box: Box): Box => ({ x: box.y, y: box.x, width: box.height, height: box.width });
```

In `src/layout/edges.ts`, directly after `shiftCurve`, add:

```ts
/** The same curve with x and y swapped on every point. */
export const transposeCurve = (curve: Curve): Curve => {
  const flip = (point: Point): Point => ({ x: point.y, y: point.x });
  return {
    from: flip(curve.from),
    segments: curve.segments.map((segment) => {
      switch (segment.kind) {
        case "line":
          return { kind: "line", to: flip(segment.to) };
        case "cubic":
          return { kind: "cubic", first: flip(segment.first), second: flip(segment.second), to: flip(segment.to) };
        default:
          return assertNever(segment, "Unhandled path segment");
      }
    }),
  };
};
```

- [ ] **Step 4: `labels.ts`.** Change the signature to `placeLabelPills(routed: readonly RoutedEdge[], swapped: boolean)` and the size to:

```ts
    const text = measure(edge.label, "sans-bold", PILL_TEXT_SIZE) + PILL_PADDING_X * 2;
    const size = swapped ? { width: PILL_HEIGHT, height: text } : { width: text, height: PILL_HEIGHT };
```

Add to its doc comment: "When `swapped`, the frame will be transposed afterwards, so the pill is sized tall-and-narrow here to come out text-shaped on screen." Update the one call in `test/layout/congestion.test.ts` (if any) to pass `false`.

- [ ] **Step 5: `layout.ts`.** Add imports `transposeBox` (geometry), `transposeCurve` (edges), `type Direction` from `../schema/primitives.js`. Add `direction: Direction;` to `Layout`. In `layout()`, replace from `const pills = placeLabelPills(routed);` through the `drawn` array with:

```ts
  const swapped = frame.direction === "down";
  const pills = placeLabelPills(routed, swapped);

  const orient = (box: Box): Box => (swapped ? transposeBox(box) : box);
  const orientCurve = (curve: Curve): Curve => (swapped ? transposeCurve(curve) : curve);

  const lanesInFrame = placed.lanes.map((lane) => ({ ...lane, box: orient(lane.box) }));
  const nodesInFrame = placed.nodes.map((node) => ({ ...node, box: orient(node.box) }));
  const curves = new Map(routed.map(({ edge, curve }) => [edge.id, orientCurve(curve)]));
  const pillBoxes = new Map([...pills].map(([id, box]) => [id, orient(box)]));
  const extent = swapped ? { width: placed.height, height: placed.width } : placed;

  const drawn: Box[] = [
    ...lanesInFrame.map(({ box }) => box),
    ...nodesInFrame.flatMap((node) => {
      const strip = badgeStrip(node);
      return strip === undefined ? [node.box] : [node.box, strip];
    }),
    ...pillBoxes.values(),
    ...[...curves.values()].map(curveBounds),
  ];
  const canvas = canvasFor(extent, union(drawn), DIAGRAM_MARGIN);

  const lanes = lanesInFrame.map((lane) => ({ ...lane, box: shiftBox(lane.box, canvas) }));
  const nodes = nodesInFrame.map((node) => ({ ...node, box: shiftBox(node.box, canvas) }));

  const edgeBoxes: Record<string, Box> = {};
  const edges: PlacedEdge[] = routed.map(({ edge }) => {
    const curve = curves.get(edge.id) ?? { from: { x: 0, y: 0 }, segments: [] };
    edgeBoxes[edge.id] = shiftBox(curveBounds(curve), canvas);
    const pill = pillBoxes.get(edge.id);
    return {
      edge,
      path: pathOf(shiftCurve(curve, canvas.shiftX, canvas.shiftY)),
      tone: edge.status,
      ...(pill === undefined || edge.label === undefined
        ? {}
        : { label: { text: edge.label, box: shiftBox(pill, canvas) } }),
    };
  });
```

Import `type Curve` from `./edges.js`. The old `lanes`/`nodes`/`edges` blocks are replaced by the above; keep the `return` but add `direction: doc.direction,` as the first field. `badgeStrip` now receives a screen-space node, so the strip lands above the card in both directions.

- [ ] **Step 6: `src/layout.ts`** — add `export type { Direction } from "./schema/primitives.js";`.

- [ ] **Step 7: Run** `npm run lint && npm run format && npm run typecheck && npm test`. The identity guard from Task 3 must still pass (for `"right"`, `orient` is the identity and `extent` is `placed`, so nothing changes). If the "keeps cards inside their band, below the header strip" test fails, check that `crossStart` (48) is what `contentX` uses in `architecture.ts` — the header strip is frame-x for `"down"`.

- [ ] **Step 8: Commit** — `git add -A && git commit -m "Transpose the frame for direction down"`.

---

### Task 5: Example toggle, browser test, docs

**Files:**
- Modify: `example/App.tsx`, `README.md`, `CLAUDE.md`
- Test: `test/browser/diagram.test.tsx`

- [ ] **Step 1: Write the failing browser test** — append inside the `describe("Diagram")` in `test/browser/diagram.test.tsx`:

```tsx
  it("draws direction down as stacked bands with cards flowing right", async () => {
    const screen = await render(<Diagram doc={{ ...ingress, direction: "down" }} />);
    const top = (selector: string) => (screen.container.querySelector(selector) as HTMLElement).getBoundingClientRect().top;
    const left = (selector: string) => (screen.container.querySelector(selector) as HTMLElement).getBoundingClientRect().left;
    expect(top("[data-conduit-lane='ingest']")).toBeGreaterThan(top("[data-conduit-lane='sources']"));
    expect(top("[data-conduit-lane='store']")).toBeGreaterThan(top("[data-conduit-lane='ingest']"));
    expect(left("[data-conduit-node='batch-loader']")).toBeGreaterThan(left("[data-conduit-node='kafka-ingest']"));
    expect(top("[data-conduit-node='batch-loader']")).toBeCloseTo(top("[data-conduit-node='kafka-ingest']"), 0);
  });
```

- [ ] **Step 2: Run** `npm run test:browser -- diagram` — the new test fails until… actually it should already pass after Task 4, because `Diagram` consumes boxes. Run it; if it passes, that is the evidence components needed no change — say so in the report. If it fails, the layout is wrong, not the component: report the numbers.

- [ ] **Step 3: Example toggle.** In `example/App.tsx` add state `const [direction, setDirection] = useState<"right" | "down">("right");`, a header button next to Fit:

```tsx
          <button
            type="button"
            className="rounded border border-conduit-card-border px-2 py-1 text-sm"
            onClick={() => setDirection((value) => (value === "right" ? "down" : "right"))}
          >
            {direction === "right" ? "Down" : "Right"}
          </button>
```

and pass `doc={{ ...ingress, direction }}` to `Diagram`. Memoise it: `const doc = useMemo(() => ({ ...ingress, direction }), [direction]);` (import `useMemo`) so `Diagram`'s layout memo isn't invalidated every render.

Add to `test/browser/example.test.tsx`:

```tsx
  it("toggles direction", async () => {
    const screen = await render(<App />);
    const before = (screen.container.querySelector("[data-conduit-lane='ingest']") as HTMLElement).getBoundingClientRect();
    await screen.getByRole("button", { name: "Down" }).click();
    const after = (screen.container.querySelector("[data-conduit-lane='ingest']") as HTMLElement).getBoundingClientRect();
    expect(after.width).toBeGreaterThan(before.width);
    await expect.element(screen.getByRole("button", { name: "Right" })).toBeVisible();
  });
```

- [ ] **Step 4: Docs.** README: in the document type block add `direction?: "right" | "down"` after `summary?`, and under the block one sentence: "`direction: \"down\"` draws lanes as horizontal bands with cards flowing left to right; `row` then means column. Default `\"right\"`." CLAUDE.md: in "Invariants worth knowing" add a bullet: "**Direction is a frame, not a second engine.** `frame.ts` feeds `architecture.ts`/`congestion.ts` the numbers for the chosen direction; the engine always lays out columns-with-rows-down and `layout()` transposes to screen space for `\"down\"`. `\"right\"` is guarded byte-identical by `test/layout/direction.test.ts`."

- [ ] **Step 5: Run** `npm run lint && npm run format && npm run typecheck && npm test && npm run build` — green. Then `npm run example`, open it, press Down: bands stacked, cards left→right, edges routed between bands, pulses still travelling; press Fit; toggle Dark. Stop the server.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "Add direction toggle to the example and document it"`.

---

## Self-review notes

- Spec coverage: schema → T1; frame table → T2; engine changes (`architecture`, `congestion`, `labels`, `layout`) → T3/T4; helpers → T4; components unchanged → verified by T5's browser test; example/README → T5; every listed test → T3 (identity), T4 (down invariants), T5 (browser).
- Type consistency: `layoutArchitecture(graph, frame, expansions?)` in T3 is what T3's test edits and T4's `layout.ts` call; `placeLabelPills(routed, swapped)` in T4 matches its call; `Frame` fields in T2 are exactly those read in T3.
- Known follow-up outside scope: `LANE_HEADER_STRIP` and the `LaneBand` header offset (`top-[14px]`) are not linked by code; the strip is 48 so the 24px-tall header fits comfortably.
