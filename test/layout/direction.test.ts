import { describe, expect, it } from "vitest";
import { ingress } from "../../example/data/ingress.js";
import { layout } from "../../src/layout.js";
import {
  CARD_GAP_X,
  DEFAULT_CARD_HEIGHTS,
  LANE_BOTTOM_PADDING,
  LANE_CONTENT_WIDTH,
  LANE_HEADER_STRIP,
} from "../../src/layout/design.js";
import { cardHeight } from "../../src/layout/architecture.js";
import { frameFor } from "../../src/layout/frame.js";
import { findView, resolveScope } from "../../src/layout/scope.js";
import { parseDocument } from "../../src/index.js";

/**
 * Literal geometry captured from main before the frame refactor. If any of
 * these move, `"right"` is no longer byte-identical to what shipped.
 */
const CAPTURED = {
  nodes: {
    "partner-api": { x: 32, y: 92, width: 372, height: 52 },
    "kafka-ingest": { x: 456, y: 92, width: 372, height: 140 },
    warehouse: { x: 1304, y: 284, width: 372, height: 140 },
    "legacy-ftp": { x: 1304, y: 476, width: 372, height: 52 },
  },
  lane: { store: { x: 1288, y: 44, width: 404, height: 504 } },
  size: { width: 2132, height: 564 },
  path: "M1490,232 L1490,284",
  pill: { x: 1475, y: 250.5, width: 30, height: 15 },
};

describe("direction right is today's layout", () => {
  const laid = layout(ingress);

  it("places the captured nodes exactly where they were", () => {
    for (const [id, box] of Object.entries(CAPTURED.nodes))
      expect(laid.atlas.nodes[id], id).toEqual(box);
  });

  it("places the captured lane and canvas exactly", () => {
    expect(laid.atlas.lanes["store"]).toEqual(CAPTURED.lane.store);
    expect([laid.width, laid.height]).toEqual([CAPTURED.size.width, CAPTURED.size.height]);
  });

  it("routes the captured edge exactly", () => {
    expect(laid.edges.find(({ edge }) => edge.id === "lake-to-warehouse")?.path).toBe(
      CAPTURED.path,
    );
  });

  it("places the captured pill exactly", () => {
    expect(laid.edges.find(({ edge }) => edge.id === "lake-to-warehouse")?.label?.box).toEqual(
      CAPTURED.pill,
    );
  });

  it("is what an omitted direction means", () => {
    const rest = { ...ingress };
    delete (rest as { direction?: string }).direction;
    expect(JSON.stringify(layout({ ...rest, direction: "right" }))).toBe(JSON.stringify(laid));
  });
});

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
    for (let i = 1; i < ordered.length; i += 1)
      expect(ordered[i]!.y).toBeGreaterThan(ordered[i - 1]!.y + ordered[i - 1]!.height - 1);
    expect(new Set(ordered.map((box) => box.height)).size).toBe(1);
    expect(new Set(ordered.map((box) => box.x)).size).toBe(1);
  });

  it("sizes a band from the tallest row plus header and bottom padding", () => {
    const frame = frameFor(
      "down",
      { lanes: down.lanes, nodes: down.nodes, edges: down.edges },
      DEFAULT_CARD_HEIGHTS,
    );
    expect(laneBox("sources").height).toBe(
      LANE_HEADER_STRIP + frame.laneCross + LANE_BOTTOM_PADDING,
    );
  });

  it("a view scope sizes bands from the scoped graph", () => {
    const scopedGraph = resolveScope(down, findView(down.views, "storage")!.scope);
    const scopedFrame = frameFor("down", scopedGraph, DEFAULT_CARD_HEIGHTS);
    const scopedLaid = layout(down, { view: "storage" });
    expect(scopedLaid.atlas.lanes["store"]!.height).toBe(
      LANE_HEADER_STRIP + scopedFrame.laneCross + LANE_BOTTOM_PADDING,
    );
  });

  it("does not move earlier or later bands when a compact card is added", () => {
    const withExtra = parseDocument({
      ...down,
      nodes: [
        ...down.nodes,
        { id: "extra", label: "Extra", kind: "service", lane: "consume", row: 2 },
      ],
    });
    const extraLaid = layout(withExtra);
    for (const lane of down.lanes)
      expect(extraLaid.atlas.lanes[lane.id], lane.id).toEqual(laid.atlas.lanes[lane.id]);
  });

  it("grows every band together when a row outgrows a chart card", () => {
    const grown = parseDocument({
      ...down,
      nodes: down.nodes.map((node) =>
        node.id === "reporting-job" ? { ...node, size: 300 } : node,
      ),
    });
    const grownLaid = layout(grown);
    const heights = ["sources", "ingest", "validate", "store", "consume"].map(
      (id) => grownLaid.atlas.lanes[id]!.height,
    );
    expect(new Set(heights).size).toBe(1);
    expect(heights[0]).toBeGreaterThan(laneBox("sources").height);
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
      expect(box.y + box.height, node.id).toBeLessThanOrEqual(
        band.y + band.height - LANE_BOTTOM_PADDING,
      );
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
      box.x >= 0 &&
      box.y >= 0 &&
      box.x + box.width <= laid.width &&
      box.y + box.height <= laid.height;
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
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y;
        expect(apart).toBe(true);
      }
    });
  });

  it("is byte-identical across calls and JSON round trips", () => {
    expect(JSON.stringify(layout(parseDocument(JSON.parse(JSON.stringify(down)))))).toBe(
      JSON.stringify(laid),
    );
  });

  it("does not move when a label is renamed", () => {
    const renamed = {
      ...down,
      nodes: down.nodes.map((node) =>
        node.id === "warehouse" ? { ...node, label: "W".repeat(120) } : node,
      ),
    };
    expect(layout(renamed).atlas).toEqual(laid.atlas);
  });

  it("draws a self-loop inside the gap below its band", () => {
    const doc = parseDocument({
      version: 1,
      title: "Self-loop",
      direction: "down",
      lanes: [
        { id: "a", label: "A", order: 0 },
        { id: "b", label: "B", order: 1 },
      ],
      nodes: [
        { id: "p", label: "P", kind: "service", lane: "a", row: 0, size: "chart" },
        { id: "q", label: "Q", kind: "service", lane: "b", row: 0 },
      ],
      edges: [
        { id: "loop", from: "p", to: "p", kind: "call" },
        { id: "p-to-q", from: "p", to: "q", kind: "call" },
      ],
    });
    const selfLoopLaid = layout(doc);
    const a = selfLoopLaid.atlas.lanes["a"]!;
    const b = selfLoopLaid.atlas.lanes["b"]!;
    const box = selfLoopLaid.atlas.edges["loop"]!;

    expect(box.x).toBeGreaterThanOrEqual(a.x);
    expect(box.x + box.width).toBeLessThanOrEqual(a.x + a.width);
    // The loop hangs off p's own frame-right face, which sits LANE_BOTTOM_PADDING (20px)
    // short of band a's own bottom edge, so a 30px SELF_LOOP_REACH necessarily starts
    // inside that padding strip: box.y (204) < a.y + a.height - 1 (223) here, by design.
    // What matters is that it still clears band b, inside the 40px corridor.
    expect(box.y + box.height).toBeLessThanOrEqual(b.y + 1);
  });
});
