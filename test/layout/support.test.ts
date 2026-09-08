import { describe, expect, it } from "vitest";
import { parseDocument } from "../../src/index.js";
import { canvasFor, union } from "../../src/layout/bounds.js";
import { roundCoord } from "../../src/layout/geometry.js";
import { findView, resolveScope } from "../../src/layout/scope.js";
import { measure } from "../../src/layout/text.js";

describe("geometry", () => {
  it("rounds to a hundredth and never emits negative zero", () => {
    expect(roundCoord(1.006)).toBe(1.01);
    expect(Object.is(roundCoord(-0.001), 0)).toBe(true);
  });
});

describe("bounds", () => {
  it("unions boxes", () => {
    expect(
      union([
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 5, y: 5, width: 10, height: 10 },
      ]),
    ).toEqual({
      x: 0,
      y: 0,
      width: 15,
      height: 15,
    });
  });

  it("shifts the canvas when something was drawn left of the margin", () => {
    const canvas = canvasFor(
      { width: 100, height: 100 },
      { x: -10, y: 0, width: 50, height: 50 },
      16,
    );
    expect(canvas.shiftX).toBe(26);
    expect(canvas.width).toBe(126);
  });
});

describe("text", () => {
  it("measures a wide character as a full em", () => {
    expect(measure("漢", "sans", 10)).toBe(10);
  });
  it("measures bold wider than regular", () => {
    expect(measure("abc", "sans-bold", 10)).toBeGreaterThan(measure("abc", "sans", 10));
  });
});

describe("scope", () => {
  const doc = parseDocument({
    version: 1,
    title: "T",
    lanes: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
    nodes: [
      { id: "n1", label: "N1", kind: "service", lane: "a" },
      { id: "n2", label: "N2", kind: "service", lane: "b" },
      { id: "n3", label: "N3", kind: "service", lane: "b" },
    ],
    edges: [
      { id: "e12", from: "n1", to: "n2", kind: "call" },
      { id: "e23", from: "n2", to: "n3", kind: "call" },
    ],
    views: [
      {
        id: "v",
        title: "V",
        children: [{ id: "child", title: "C", scope: { kind: "selection", nodes: ["n1"] } }],
      },
    ],
  });

  it("finds a nested view", () => {
    expect(findView(doc.views, "child")?.title).toBe("C");
  });

  it("pulls in both ends of a named edge and the lanes they sit in", () => {
    const graph = resolveScope(doc, { kind: "selection", lanes: [], nodes: [], edges: ["e12"] });
    expect(graph.nodes.map((n) => n.id)).toEqual(["n1", "n2"]);
    expect(graph.lanes.map((l) => l.id)).toEqual(["a", "b"]);
    expect(graph.edges.map((e) => e.id)).toEqual(["e12"]);
  });

  it("keeps the edges between selected nodes when none are named", () => {
    const graph = resolveScope(doc, { kind: "selection", lanes: ["b"], nodes: [], edges: [] });
    expect(graph.nodes.map((n) => n.id)).toEqual(["n2", "n3"]);
    expect(graph.edges.map((e) => e.id)).toEqual(["e23"]);
  });
});
