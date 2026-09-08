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
  lanes: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
  ],
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
    expect(frame.crossSplit({ grid: 0, nodes: [n1!, n2!] })).toEqual([
      half,
      LANE_CONTENT_WIDTH - CARD_GAP_X - half,
    ]);
    expect(frame.crossSplit({ grid: 0, nodes: [chart!] })).toEqual([LANE_CONTENT_WIDTH]);
  });
});

describe("frameFor down", () => {
  const frame = frameFor("down", graph, heights);

  it("runs 372 along the flow and the declared height across it", () => {
    const [n1, n2, , big] = doc.nodes;
    expect(frame.along(n1!)).toBe(LANE_CONTENT_WIDTH);
    expect(frame.along(big!)).toBe(LANE_CONTENT_WIDTH);
    expect(frame.crossSplit({ grid: 0, nodes: [n1!, n2!] })).toEqual([
      heights.compact,
      heights.withSubtitle,
    ]);
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
    const pairFrame = frameFor(
      "down",
      { lanes: pairDoc.lanes, nodes: pairDoc.nodes, edges: [] },
      heights,
    );
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
    expect(
      frameFor("down", { lanes: tiny.lanes, nodes: tiny.nodes, edges: [] }, heights).laneCross,
    ).toBe(heights.compact);
  });
});
