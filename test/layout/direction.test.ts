import { describe, expect, it } from "vitest";
import { ingress } from "../../example/data/ingress.js";
import { layout } from "../../src/layout.js";

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

  it("is what an omitted direction means", () => {
    const rest = { ...ingress };
    delete (rest as { direction?: string }).direction;
    expect(JSON.stringify(layout({ ...rest, direction: "right" }))).toBe(JSON.stringify(laid));
  });
});
