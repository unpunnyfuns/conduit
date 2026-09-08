import { describe, expect, it } from "vitest";
import { parseDocument, type Edge, type LensNode } from "../../src/index.js";
import { LensLayoutError } from "../../src/layout/errors.js";
import { rankNodes } from "../../src/layout/rank.js";
import { seatNodes } from "../../src/layout/seating.js";

const node = (id: string, lane: string, extra: Partial<LensNode> = {}): LensNode => ({
  id,
  label: id,
  kind: "other",
  lane,
  status: "neutral",
  badges: [],
  size: "compact",
  ...extra,
});

const edge = (from: string, to: string): Edge => ({
  id: `${from}-${to}`,
  from,
  to,
  kind: "call",
  emphasis: "normal",
  animated: false,
  status: "neutral",
});

const lanes = [
  { id: "a", label: "A", status: "neutral" as const },
  { id: "b", label: "B", status: "neutral" as const },
];

const gridOf = (seating: ReturnType<typeof seatNodes>, lane: string) =>
  (seating.rowsByLane.get(lane) ?? []).map((row) => [row.grid, row.nodes.map((n) => n.id)]);

describe("ranking", () => {
  it("puts every node below the ones that feed it", () => {
    const ranks = rankNodes(
      [node("a", "a"), node("b", "a"), node("c", "a")],
      [edge("a", "b"), edge("b", "c")],
      {},
    );
    expect([ranks.get("a"), ranks.get("b"), ranks.get("c")]).toEqual([0, 1, 2]);
  });

  it("still ranks a cycle by dropping the edge that closes it", () => {
    const ranks = rankNodes(
      [node("a", "a"), node("b", "a"), node("c", "a")],
      [edge("a", "b"), edge("b", "c"), edge("c", "a")],
      {},
    );
    expect([ranks.get("a"), ranks.get("b"), ranks.get("c")]).toEqual([0, 1, 2]);
  });

  it("does not let a hint lift a node above what feeds it", () => {
    const ranks = rankNodes([node("a", "a"), node("b", "a")], [edge("a", "b")], { a: 3, b: 0 });
    expect([ranks.get("a"), ranks.get("b")]).toEqual([3, 4]);
  });
});

describe("automatic seating", () => {
  it("compresses ranks onto contiguous rows across lanes", () => {
    const seating = seatNodes(
      lanes,
      [node("x", "a"), node("y", "b"), node("z", "b")],
      [edge("x", "y"), edge("y", "z")],
    );
    expect(gridOf(seating, "a")).toEqual([[0, ["x"]]]);
    expect(gridOf(seating, "b")).toEqual([
      [1, ["y"]],
      [2, ["z"]],
    ]);
    expect(seating.rowCount).toBe(3);
  });

  it("pairs two same-rank, same-group cards in one row", () => {
    const seating = seatNodes(
      lanes,
      [node("p", "a", { group: "g" }), node("q", "a", { group: "g" })],
      [],
    );
    expect(gridOf(seating, "a")).toEqual([[0, ["p", "q"]]]);
  });

  it("never pairs across groups", () => {
    const seating = seatNodes(lanes, [node("p", "a", { group: "g" }), node("q", "a")], []);
    expect(gridOf(seating, "a")).toEqual([
      [0, ["p"]],
      [1, ["q"]],
    ]);
  });
});

describe("explicit rows", () => {
  it("pins a node to its row", () => {
    const seating = seatNodes(lanes, [node("p", "a", { row: 3 })], []);
    expect(gridOf(seating, "a")).toEqual([[3, ["p"]]]);
    expect(seating.rowCount).toBe(4);
  });

  it("seats two pinned nodes in the same row side by side, in array order", () => {
    const seating = seatNodes(lanes, [node("q", "a", { row: 1 }), node("p", "a", { row: 1 })], []);
    expect(gridOf(seating, "a")).toEqual([[1, ["q", "p"]]]);
  });

  it("throws ROW_OVERFULL for three in one row", () => {
    expect(() =>
      seatNodes(
        lanes,
        [node("p", "a", { row: 0 }), node("q", "a", { row: 0 }), node("r", "a", { row: 0 })],
        [],
      ),
    ).toThrow(LensLayoutError);
    try {
      seatNodes(
        lanes,
        [node("p", "a", { row: 0 }), node("q", "a", { row: 0 }), node("r", "a", { row: 0 })],
        [],
      );
    } catch (error) {
      expect((error as LensLayoutError).code).toBe("ROW_OVERFULL");
    }
  });

  it("routes automatic nodes around claimed rows", () => {
    const seating = seatNodes(lanes, [node("pinned", "a", { row: 0 }), node("auto", "a")], []);
    expect(gridOf(seating, "a")).toEqual([
      [0, ["pinned"]],
      [1, ["auto"]],
    ]);
  });

  it("keeps an automatic successor below its pinned source", () => {
    const seating = seatNodes(
      lanes,
      [node("src", "a", { row: 2 }), node("dst", "b")],
      [edge("src", "dst")],
    );
    expect(gridOf(seating, "b")).toEqual([[3, ["dst"]]]);
  });

  it("survives a parse round trip", () => {
    const doc = parseDocument({
      version: 1,
      title: "T",
      lanes: [{ id: "a", label: "A" }],
      nodes: [{ id: "n", label: "N", kind: "service", lane: "a", row: 5 }],
    });
    expect(gridOf(seatNodes(doc.lanes, doc.nodes, doc.edges), "a")).toEqual([[5, ["n"]]]);
  });
});
