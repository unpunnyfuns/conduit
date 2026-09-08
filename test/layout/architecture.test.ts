import { describe, expect, it } from "vitest";
import { parseDocument } from "../../src/index.js";
import { layoutArchitecture } from "../../src/layout/architecture.js";
import { DEFAULT_CARD_HEIGHTS, LANE_CONTENT_WIDTH, CARD_GAP_X } from "../../src/layout/design.js";

const doc = parseDocument({
  version: 1,
  title: "T",
  lanes: [
    { id: "b", label: "B", order: 1 },
    { id: "a", label: "A", order: 0 },
  ],
  nodes: [
    { id: "n1", label: "N1", kind: "service", lane: "a", row: 0 },
    { id: "n2", label: "N2", kind: "service", lane: "a", row: 0 },
    { id: "chart", label: "Chart", kind: "queue", lane: "b", row: 0, size: "chart" },
    { id: "sub", label: "Sub", kind: "queue", lane: "b", row: 1, subtitle: "x" },
    { id: "px", label: "Px", kind: "queue", lane: "a", row: 1, size: 200 },
  ],
});

const graph = { lanes: doc.lanes, nodes: doc.nodes, edges: doc.edges };
const layout = layoutArchitecture(graph, DEFAULT_CARD_HEIGHTS);
const placed = (id: string) => layout.nodes.find(({ node }) => node.id === id);

describe("layoutArchitecture", () => {
  it("orders lanes by `order`, not array position", () => {
    expect(layout.lanes.map(({ lane }) => lane.id)).toEqual(["a", "b"]);
  });

  it("gives every lane the same width", () => {
    const widths = new Set(layout.lanes.map(({ box }) => box.width));
    expect(widths.size).toBe(1);
  });

  it("splits a pair into equal halves", () => {
    const half = Math.round((LANE_CONTENT_WIDTH - CARD_GAP_X) / 2);
    expect(placed("n1")?.box.width).toBe(half);
    expect(placed("n2")?.box.width).toBe(LANE_CONTENT_WIDTH - CARD_GAP_X - half);
  });

  it("sizes cards by declared size", () => {
    expect(placed("n1")?.box.height).toBe(DEFAULT_CARD_HEIGHTS.compact);
    expect(placed("sub")?.box.height).toBe(DEFAULT_CARD_HEIGHTS.withSubtitle);
    expect(placed("chart")?.box.height).toBe(DEFAULT_CARD_HEIGHTS.chart);
    expect(placed("px")?.box.height).toBe(200);
  });

  it("makes a row as tall as its tallest card", () => {
    expect(layout.grid.rows[0]?.height).toBe(DEFAULT_CARD_HEIGHTS.chart);
    expect(layout.grid.rows[1]?.height).toBe(200);
  });

  it("honours a custom chart height", () => {
    const tall = layoutArchitecture(graph, { ...DEFAULT_CARD_HEIGHTS, chart: 300 });
    expect(tall.nodes.find(({ node }) => node.id === "chart")?.box.height).toBe(300);
  });

  it("has one corridor per lane plus one after the last", () => {
    expect(layout.grid.corridors.length).toBe(layout.lanes.length + 1);
  });

  it("reports whole-number dimensions", () => {
    expect(Number.isInteger(layout.width)).toBe(true);
    expect(Number.isInteger(layout.height)).toBe(true);
  });
});
