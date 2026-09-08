import { describe, expect, it } from "vitest";
import { ConduitDocumentError, parseDocument, safeParseDocument } from "../../src/index.js";

const minimal = {
  version: 1,
  title: "Minimal",
  lanes: [{ id: "a", label: "A" }],
  nodes: [{ id: "n1", label: "N1", kind: "service", lane: "a" }],
};

describe("parseDocument", () => {
  it("applies defaults", () => {
    const doc = parseDocument(minimal);
    expect(doc.edges).toEqual([]);
    expect(doc.views).toEqual([]);
    expect(doc.nodes[0]?.status).toBe("neutral");
    expect(doc.nodes[0]?.badges).toEqual([]);
    expect(doc.lanes[0]?.status).toBe("neutral");
  });

  it("applies edge defaults", () => {
    const doc = parseDocument({
      ...minimal,
      nodes: [...minimal.nodes, { id: "n2", label: "N2", kind: "job", lane: "a" }],
      edges: [{ id: "e", from: "n1", to: "n2", kind: "call" }],
    });
    expect(doc.edges[0]).toMatchObject({ emphasis: "normal", animated: false, status: "neutral" });
  });

  it("rejects an unknown field", () => {
    expect(() => parseDocument({ ...minimal, provenance: {} })).toThrow(ConduitDocumentError);
  });

  it("rejects a node in an unknown lane", () => {
    const result = safeParseDocument({
      ...minimal,
      nodes: [{ id: "n1", label: "N1", kind: "service", lane: "missing" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BROKEN_REFERENCE");
      expect(result.error.issues[0]?.path).toBe("nodes[0].lane");
    }
  });

  it("rejects an edge to an unknown node", () => {
    const result = safeParseDocument({
      ...minimal,
      edges: [{ id: "e", from: "n1", to: "ghost", kind: "call" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("BROKEN_REFERENCE");
  });

  it("rejects duplicate ids", () => {
    const result = safeParseDocument({
      ...minimal,
      nodes: [...minimal.nodes, { id: "n1", label: "Again", kind: "job", lane: "a" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DUPLICATE_ID");
  });

  it("rejects a view scope naming an unknown node", () => {
    const result = safeParseDocument({
      ...minimal,
      views: [{ id: "v", title: "V", scope: { kind: "selection", nodes: ["ghost"] } }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.issues[0]?.path).toBe("views[0].scope.nodes[0]");
  });

  it("rejects an empty selection", () => {
    const result = safeParseDocument({
      ...minimal,
      views: [{ id: "v", title: "V", scope: { kind: "selection" } }],
    });
    expect(result.ok).toBe(false);
  });

  it("accepts an explicit row and a chart size", () => {
    const doc = parseDocument({
      ...minimal,
      nodes: [{ id: "n1", label: "N1", kind: "service", lane: "a", row: 2, size: "chart" }],
    });
    expect(doc.nodes[0]?.row).toBe(2);
    expect(doc.nodes[0]?.size).toBe("chart");
  });

  it("rejects a version other than 1", () => {
    expect(() => parseDocument({ ...minimal, version: 2 })).toThrow(ConduitDocumentError);
  });

  it("defaults direction to right", () => {
    expect(parseDocument(minimal).direction).toBe("right");
  });

  it("accepts direction down", () => {
    expect(parseDocument({ ...minimal, direction: "down" }).direction).toBe("down");
  });

  it("rejects an unknown direction", () => {
    expect(() => parseDocument({ ...minimal, direction: "up" })).toThrow(ConduitDocumentError);
  });
});
