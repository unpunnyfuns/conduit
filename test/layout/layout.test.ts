import { describe, expect, it } from "vitest";
import { ingress } from "../../example/data/ingress.js";
import { parseDocument } from "../../src/index.js";
import { layout, LensLayoutError } from "../../src/layout.js";

const boxesOf = (doc: typeof ingress) =>
  new Map(
    layout(doc).nodes.map(({ node, box }) => [
      node.id,
      `${box.x},${box.y},${box.width},${box.height}`,
    ]),
  );

describe("layout()", () => {
  const laid = layout(ingress);

  it("places every lane, node and edge", () => {
    expect(laid.lanes.length).toBe(ingress.lanes.length);
    expect(laid.nodes.length).toBe(ingress.nodes.length);
    expect(laid.edges.length).toBe(ingress.edges.length);
  });

  it("fills the atlas with the same boxes it placed", () => {
    for (const { node, box } of laid.nodes) expect(laid.atlas.nodes[node.id]).toEqual(box);
    for (const { lane, box } of laid.lanes) expect(laid.atlas.lanes[lane.id]).toEqual(box);
    expect(Object.keys(laid.atlas.edges).length).toBe(ingress.edges.length);
  });

  it("keeps everything inside the canvas", () => {
    for (const { box } of laid.nodes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(laid.width);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(laid.height);
    }
    for (const id of Object.keys(laid.atlas.edges)) {
      const box = laid.atlas.edges[id];
      expect(box).toBeDefined();
      if (box === undefined) continue;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(laid.width);
      expect(box.y + box.height).toBeLessThanOrEqual(laid.height);
    }
  });

  it("carries the edge status as its tone", () => {
    expect(laid.edges.find(({ edge }) => edge.id === "batch-to-legacy")?.tone).toBe("critical");
    expect(laid.edges.find(({ edge }) => edge.id === "lake-to-warehouse")?.tone).toBe("neutral");
  });

  it("gives every labelled edge a pill box and no two pills intersect", () => {
    const pills = laid.edges.flatMap(({ label }) => (label === undefined ? [] : [label.box]));
    expect(pills.length).toBe(ingress.edges.filter((edge) => edge.label !== undefined).length);
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
    const again = layout(parseDocument(JSON.parse(JSON.stringify(ingress))));
    expect(JSON.stringify(again)).toBe(JSON.stringify(laid));
  });

  it("does not move when a field it never draws changes", () => {
    const annotated = {
      ...ingress,
      nodes: ingress.nodes.map((node) => ({ ...node, summary: "Different prose." })),
    };
    expect(boxesOf(annotated)).toEqual(boxesOf(ingress));
  });

  it("does not move when a label is renamed", () => {
    const renamed = {
      ...ingress,
      nodes: ingress.nodes.map((node) =>
        node.id === "warehouse" ? { ...node, label: "W".repeat(120) } : node,
      ),
    };
    expect(boxesOf(renamed)).toEqual(boxesOf(ingress));
  });

  it("lays out a view's selection only", () => {
    const scoped = layout(ingress, { view: "ingestion-path" });
    expect(scoped.lanes.map(({ lane }) => lane.id)).toEqual(["sources", "ingest", "validate"]);
    expect(scoped.edges.every(({ edge }) => !edge.id.startsWith("warehouse"))).toBe(true);
  });

  it("throws UNKNOWN_VIEW", () => {
    expect(() => layout(ingress, { view: "nope" })).toThrow(LensLayoutError);
    try {
      layout(ingress, { view: "nope" });
    } catch (error) {
      expect((error as LensLayoutError).code).toBe("UNKNOWN_VIEW");
    }
  });

  it("throws NOTHING_TO_RENDER for a view whose edge selection names nothing drawable", () => {
    const doc = parseDocument({
      version: 1,
      title: "T",
      lanes: [{ id: "a", label: "A" }],
      nodes: [{ id: "n", label: "N", kind: "service", lane: "a" }],
      views: [{ id: "v", title: "V", scope: { kind: "selection", lanes: ["a"] } }],
    });
    const empty = { ...doc, nodes: [], views: doc.views };
    expect(() => layout(empty as typeof doc, { view: "v" })).toThrow(/NOTHING_TO_RENDER|no nodes/);
  });

  it("honours cardHeights", () => {
    const tall = layout(ingress, { cardHeights: { chart: 220 } });
    expect(tall.nodes.find(({ node }) => node.id === "warehouse")?.box.height).toBe(220);
  });
});
