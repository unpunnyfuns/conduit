import { describe, expect, it } from "vitest";
import { ingress } from "../../example/data/ingress.js";
import type { Edge } from "../../src/index.js";
import { traceFrom } from "../../src/layout/trace.js";

const sorted = (set: Set<string>) => [...set].sort();

const edge = (id: string, from: string, to: string): Edge => ({
  id,
  from,
  to,
  kind: "call",
  emphasis: "normal",
  animated: false,
  status: "neutral",
});

describe("traceFrom on the ingress document", () => {
  it("upstream of warehouse reaches every source and nothing downstream", () => {
    const trace = traceFrom(ingress.edges, ["warehouse"], "upstream");
    expect(sorted(trace.nodes)).toEqual(
      [
        "batch-loader",
        "kafka-ingest",
        "partner-api",
        "pii-scrubber",
        "raw-lake",
        "schema-validator",
        "sftp-drop",
        "warehouse",
        "webhooks",
      ].sort(),
    );
    expect(sorted(trace.edges)).toEqual(
      [
        "batch-to-validator",
        "kafka-to-validator",
        "lake-to-warehouse",
        "partner-to-kafka",
        "scrubber-to-lake",
        "sftp-to-batch",
        "validator-to-scrubber",
        "webhooks-to-kafka",
      ].sort(),
    );
    expect(trace.nodes.has("analytics-ui")).toBe(false);
    expect(trace.nodes.has("legacy-ftp")).toBe(false);
    expect(trace.edges.has("warehouse-to-ui")).toBe(false);
    expect(trace.edges.has("batch-to-legacy")).toBe(false);
  });

  it("downstream of kafka-ingest reaches the consumers", () => {
    const trace = traceFrom(ingress.edges, ["kafka-ingest"], "downstream");
    expect(sorted(trace.nodes)).toEqual(
      [
        "analytics-ui",
        "kafka-ingest",
        "pii-scrubber",
        "raw-lake",
        "reporting-job",
        "schema-validator",
        "warehouse",
      ].sort(),
    );
    expect(trace.nodes.has("partner-api")).toBe(false);
  });

  it("both is the union", () => {
    const both = traceFrom(ingress.edges, ["schema-validator"], "both");
    const up = traceFrom(ingress.edges, ["schema-validator"], "upstream");
    const down = traceFrom(ingress.edges, ["schema-validator"], "downstream");
    expect(sorted(both.nodes)).toEqual(sorted(new Set([...up.nodes, ...down.nodes])));
    expect(sorted(both.edges)).toEqual(sorted(new Set([...up.edges, ...down.edges])));
  });

  it("neighbours lights the seed and its touching edges only", () => {
    const trace = traceFrom(ingress.edges, ["schema-validator"], "neighbours");
    expect(sorted(trace.nodes)).toEqual(["schema-validator"]);
    expect(sorted(trace.edges)).toEqual(
      ["batch-to-validator", "kafka-to-validator", "validator-to-scrubber"].sort(),
    );
  });

  it("a seeded edge id lights only that edge in every mode", () => {
    for (const mode of ["neighbours", "upstream", "downstream", "both"] as const) {
      const trace = traceFrom(ingress.edges, ["lake-to-warehouse"], mode);
      expect(sorted(trace.edges), mode).toEqual(["lake-to-warehouse"]);
      expect(trace.nodes.size, mode).toBe(0);
    }
  });

  it("ignores unknown ids", () => {
    const trace = traceFrom(ingress.edges, ["nope"], "upstream");
    expect(trace.nodes.size).toBe(1);
    expect(trace.nodes.has("nope")).toBe(true);
    expect(trace.edges.size).toBe(0);
  });
});

describe("traceFrom on synthetic graphs", () => {
  it("terminates on a cycle and lights both sides", () => {
    const edges = [edge("ab", "a", "b"), edge("ba", "b", "a")];
    const trace = traceFrom(edges, ["a"], "upstream");
    expect(sorted(trace.nodes)).toEqual(["a", "b"]);
    expect(sorted(trace.edges)).toEqual(["ab", "ba"]);
  });

  it("does not follow a self-loop when tracing, but lights it as a neighbour", () => {
    const edges = [edge("aa", "a", "a"), edge("ba", "b", "a")];
    const up = traceFrom(edges, ["a"], "upstream");
    expect(sorted(up.edges)).toEqual(["ba"]);
    const near = traceFrom(edges, ["a"], "neighbours");
    expect(sorted(near.edges)).toEqual(["aa", "ba"]);
  });
});
