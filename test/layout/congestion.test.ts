import { describe, expect, it } from "vitest";
import { parseDocument } from "../../src/index.js";
import type { Direction } from "../../src/schema/primitives.js";
import { layout } from "../../src/layout.js";
import { layoutArchitecture, type ArchitectureLayout } from "../../src/layout/architecture.js";
import { relieveCongestion } from "../../src/layout/congestion.js";
import { DEFAULT_CARD_HEIGHTS, LANE_GAP, TRACK_PITCH_MIN } from "../../src/layout/design.js";
import { frameFor } from "../../src/layout/frame.js";
import type { ScopedGraph } from "../../src/layout/scope.js";

type ExtraEdge = { id: string; from: string; to: string };

/** 8 rows per lane, one node each, so every edge below is a clean cross-lane run. */
const laneNodes = (lane: string) =>
  Array.from({ length: 8 }, (_, row) => ({
    id: `${lane}${row}`,
    label: `${lane.toUpperCase()}${row}`,
    kind: "service" as const,
    lane,
    row,
  }));

/** `edgeCount` of the corridor-1 edges `a{i} -> b{(i+3)%8}`, plus any extras. */
const buildDoc = (
  edgeCount: number,
  extra: readonly ExtraEdge[] = [],
  direction: Direction = "right",
) =>
  parseDocument({
    version: 1,
    title: "Congestion",
    direction,
    lanes: [
      { id: "a", label: "A", order: 0 },
      { id: "b", label: "B", order: 1 },
    ],
    nodes: [...laneNodes("a"), ...laneNodes("b")],
    edges: [
      ...Array.from({ length: edgeCount }, (_, i) => ({
        id: `a${i}-b${(i + 3) % 8}`,
        from: `a${i}`,
        to: `b${(i + 3) % 8}`,
        kind: "data" as const,
      })),
      ...extra.map((edge) => ({ ...edge, kind: "data" as const })),
    ],
  });

const graphOf = (doc: ReturnType<typeof buildDoc>): ScopedGraph => ({
  lanes: doc.lanes,
  nodes: doc.nodes,
  edges: doc.edges,
});

/**
 * The width of the corridor between lane a and lane b — box.x for
 * `"right"`, where lanes sit side by side, or box.y for `"down"`, where
 * `layout()` has transposed them into bands stacked top to bottom.
 */
const gapBetween = (doc: ReturnType<typeof buildDoc>, direction: Direction = "right"): number => {
  const laid = layout(doc);
  const laneA = laid.lanes.find(({ lane }) => lane.id === "a");
  const laneB = laid.lanes.find(({ lane }) => lane.id === "b");
  if (laneA === undefined || laneB === undefined) throw new Error("lane a or b missing");
  return direction === "right"
    ? laneB.box.x - (laneA.box.x + laneA.box.width)
    : laneB.box.y - (laneA.box.y + laneA.box.height);
};

const nodeBoxes = (architecture: ArchitectureLayout) =>
  JSON.stringify(architecture.nodes.map(({ box }) => box));

const bandY = (laid: ReturnType<typeof layout>) => laid.atlas.lanes["b"]!.y;

describe("congestion", () => {
  it("widens a saturated corridor", () => {
    const saturated = gapBetween(buildDoc(8));
    const uncrowded = gapBetween(buildDoc(3));
    expect(saturated).toBeGreaterThan(uncrowded);
    expect(uncrowded).toBe(LANE_GAP);
  });

  it("an uncrowded document is untouched", () => {
    const graph = graphOf(buildDoc(3));
    const frame = frameFor("right", graph, DEFAULT_CARD_HEIGHTS);
    const plain = layoutArchitecture(graph, frame);
    const relieved = relieveCongestion(graph, frame).layout;
    expect(nodeBoxes(relieved)).toBe(nodeBoxes(plain));
  });

  // 9 tracks (widthNeeded = 8*TRACK_PITCH_MIN + 2*TRACK_CLEARANCE = 92) already
  // needs more room than 8 tracks (82) at the floor pitch, so 8 vs 9 lands on
  // one pitch step directly; the 8-vs-10 fallback in the brief is not needed.
  it("adding one edge to a saturated gap moves lanes by exactly one pitch step", () => {
    const eight = gapBetween(buildDoc(8));
    const nine = gapBetween(buildDoc(8, [{ id: "extra", from: "a0", to: "b5" }]));
    expect(nine - eight).toBe(TRACK_PITCH_MIN);
  });

  it("is deterministic under expansion", () => {
    const doc = buildDoc(8);
    expect(JSON.stringify(layout(doc))).toBe(JSON.stringify(layout(doc)));
  });
});

describe("direction down", () => {
  it("widens a saturated corridor", () => {
    const saturated = gapBetween(buildDoc(8, [], "down"), "down");
    const uncrowded = gapBetween(buildDoc(3, [], "down"), "down");
    expect(saturated).toBeGreaterThan(uncrowded);
    expect(uncrowded).toBe(LANE_GAP);
  });

  // Same 8-vs-9 edge counts as the right-direction test above: 9 tracks
  // already needs more room than 8 tracks at the floor pitch, so it lands
  // on one pitch step directly.
  it("one added edge moves bands by exactly one pitch step", () => {
    const eight = layout(buildDoc(8, [], "down"));
    const nine = layout(buildDoc(8, [{ id: "extra", from: "a0", to: "b5" }], "down"));
    expect(bandY(nine) - bandY(eight)).toBe(TRACK_PITCH_MIN);
  });

  it("pairs with heavy traffic route without overlap", () => {
    const heavy = parseDocument({
      version: 1,
      title: "Heavy pairs",
      direction: "down",
      lanes: [
        { id: "a", label: "A", order: 0 },
        { id: "b", label: "B", order: 1 },
      ],
      nodes: [
        { id: "a0", label: "A0", kind: "service", lane: "a", row: 0 },
        { id: "a1", label: "A1", kind: "service", lane: "a", row: 0 },
        { id: "b0", label: "B0", kind: "service", lane: "b", row: 0 },
        { id: "b1", label: "B1", kind: "service", lane: "b", row: 0 },
      ],
      edges: [
        { id: "e0", from: "a0", to: "b0", kind: "data" },
        { id: "e1", from: "a0", to: "b1", kind: "data" },
        { id: "e2", from: "a1", to: "b0", kind: "data" },
        { id: "e3", from: "a1", to: "b1", kind: "data" },
        { id: "e4", from: "a0", to: "b0", kind: "data" },
        { id: "e5", from: "a1", to: "b1", kind: "data" },
      ],
    });

    expect(() => layout(heavy)).not.toThrow();
    const laid = layout(heavy);
    const laneBox = (id: string) => laid.atlas.lanes[id]!;
    for (const { node, box } of laid.nodes) {
      const band = laneBox(node.lane);
      expect(box.x, node.id).toBeGreaterThanOrEqual(band.x);
      expect(box.x + box.width, node.id).toBeLessThanOrEqual(band.x + band.width);
      expect(box.y, node.id).toBeGreaterThanOrEqual(band.y);
      expect(box.y + box.height, node.id).toBeLessThanOrEqual(band.y + band.height);
    }
    const boxes = laid.nodes.map(({ box }) => box);
    boxes.forEach((a, i) => {
      for (const b of boxes.slice(i + 1)) {
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y;
        expect(apart).toBe(true);
      }
    });
  });
});
