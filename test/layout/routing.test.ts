import { describe, expect, it } from "vitest";
import { parseDocument, type ConduitDocument } from "../../src/index.js";
import { layoutArchitecture } from "../../src/layout/architecture.js";
import { DEFAULT_CARD_HEIGHTS } from "../../src/layout/design.js";
import { curveBounds, pathOf, routeEdges, shiftCurve } from "../../src/layout/edges.js";
import { frameFor } from "../../src/layout/frame.js";

const routesOf = (doc: ConduitDocument) => {
  const graph = { lanes: doc.lanes, nodes: doc.nodes, edges: doc.edges };
  return routeEdges(
    doc.edges,
    layoutArchitecture(graph, frameFor("right", graph, DEFAULT_CARD_HEIGHTS)),
  );
};

const isStraight = (path: string): boolean => /^M[-\d.,]+ L[-\d.,]+$/.test(path);

const doc = parseDocument({
  version: 1,
  title: "Routing",
  lanes: [
    { id: "a", label: "A", order: 0 },
    { id: "b", label: "B", order: 1 },
    { id: "c", label: "C", order: 2 },
  ],
  nodes: [
    { id: "a0", label: "a0", kind: "service", lane: "a", row: 0 },
    { id: "a1", label: "a1", kind: "service", lane: "a", row: 1 },
    { id: "a3", label: "a3", kind: "service", lane: "a", row: 3 },
    { id: "b0", label: "b0", kind: "service", lane: "b", row: 0 },
    { id: "b1", label: "b1", kind: "service", lane: "b", row: 1 },
    { id: "c0", label: "c0", kind: "service", lane: "c", row: 0 },
    { id: "b2", label: "b2", kind: "service", lane: "b", row: 2 },
    { id: "b3", label: "b3", kind: "service", lane: "b", row: 3 },
  ],
  edges: [
    { id: "neighbours", from: "a0", to: "b0", kind: "call" },
    { id: "stacked", from: "a0", to: "a1", kind: "call", label: "down" },
    { id: "skip", from: "a0", to: "a3", kind: "call" },
    { id: "far", from: "a0", to: "c0", kind: "http" },
    { id: "loop", from: "b0", to: "b0", kind: "call" },
    { id: "stem1", from: "b0", to: "b1", kind: "call" },
    { id: "stem2", from: "b0", to: "b2", kind: "call" },
  ],
});

const routed = routesOf(doc);
const pathFor = (id: string) => routed.find(({ edge }) => edge.id === id)?.path ?? "";

describe("routeEdges", () => {
  it("routes every edge", () => {
    expect(routed.map(({ edge }) => edge.id)).toEqual(doc.edges.map((edge) => edge.id));
  });

  it("draws aligned neighbours dead straight", () => {
    expect(isStraight(pathFor("neighbours"))).toBe(true);
    expect(isStraight(pathFor("stacked"))).toBe(true);
  });

  it("curves a route that skips rows", () => {
    expect(isStraight(pathFor("skip"))).toBe(false);
    expect(pathFor("skip")).toContain("C");
  });

  it("crosses an intermediate lane without passing through its card", () => {
    const graph = { lanes: doc.lanes, nodes: doc.nodes, edges: doc.edges };
    const b0 = layoutArchitecture(graph, frameFor("right", graph, DEFAULT_CARD_HEIGHTS)).nodes.find(
      ({ node }) => node.id === "b0",
    );
    const bounds = curveBounds(
      routed.find(({ edge }) => edge.id === "far")?.curve ?? { from: { x: 0, y: 0 }, segments: [] },
    );
    expect(b0).toBeDefined();
    if (b0 === undefined) return;
    const crossesCard =
      bounds.y < b0.box.y + b0.box.height &&
      bounds.y + bounds.height > b0.box.y &&
      bounds.x < b0.box.x + b0.box.width &&
      bounds.x + bounds.width > b0.box.x;
    expect(crossesCard && bounds.height < 1).toBe(false);
  });

  it("draws a self-loop off the right face", () => {
    expect(pathFor("loop")).toMatch(/^M[-\d.]+,[-\d.]+ C/);
  });

  it("fans same-lane siblings out of one shared port", () => {
    const starts = ["stem1", "stem2"].map((id) => pathFor(id).match(/^M([-\d.]+,[-\d.]+)/)?.[1]);
    expect(new Set(starts).size).toBe(1);
  });

  it("gives a labelled edge an anchor and an unlabelled one none", () => {
    expect(routed.find(({ edge }) => edge.id === "stacked")?.labelAnchor).toBeDefined();
    expect(routed.find(({ edge }) => edge.id === "skip")?.labelAnchor).toBeUndefined();
  });

  it("is deterministic", () => {
    expect(routesOf(doc).map(({ path }) => path)).toEqual(routed.map(({ path }) => path));
  });
});

describe("curve helpers", () => {
  it("shifts every point of a curve", () => {
    const curve = routed[0]?.curve;
    expect(curve).toBeDefined();
    if (curve === undefined) return;
    const shifted = shiftCurve(curve, 10, 20);
    expect(shifted.from).toEqual({ x: curve.from.x + 10, y: curve.from.y + 20 });
    expect(pathOf(shifted)).not.toBe(pathOf(curve));
    expect(curveBounds(shifted).x).toBeCloseTo(curveBounds(curve).x + 10);
  });
});
