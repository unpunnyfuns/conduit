import { describe, expect, it } from "vitest";
import { parseDocument } from "../../src/index.js";
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
const buildDoc = (edgeCount: number, extra: readonly ExtraEdge[] = []) =>
  parseDocument({
    version: 1,
    title: "Congestion",
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

/** Lane b's box.x minus lane a's right edge — the width of the corridor between them. */
const gapBetween = (doc: ReturnType<typeof buildDoc>): number => {
  const laid = layout(doc);
  const laneA = laid.lanes.find(({ lane }) => lane.id === "a");
  const laneB = laid.lanes.find(({ lane }) => lane.id === "b");
  if (laneA === undefined || laneB === undefined) throw new Error("lane a or b missing");
  return laneB.box.x - (laneA.box.x + laneA.box.width);
};

const nodeBoxes = (architecture: ArchitectureLayout) =>
  JSON.stringify(architecture.nodes.map(({ box }) => box));

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
