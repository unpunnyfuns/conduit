import type { Edge } from "../schema/document.js";
import { assertNever } from "../assert.js";

export type Highlight = "neighbours" | "upstream" | "downstream" | "both";

export type Trace = { nodes: Set<string>; edges: Set<string> };

const walk = (
  edges: readonly Edge[],
  seeds: ReadonlySet<string>,
  forward: boolean,
  into: Trace,
): void => {
  const queue = [...seeds];
  const visited = new Set(seeds);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const edge of edges) {
      if (edge.from === edge.to) continue;
      const [here, next] = forward ? [edge.from, edge.to] : [edge.to, edge.from];
      if (here !== current) continue;
      into.edges.add(edge.id);
      into.nodes.add(next);
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
};

export const traceFrom = (
  edges: readonly Edge[],
  seeds: readonly string[],
  highlight: Highlight,
): Trace => {
  const edgeIds = new Set(edges.map((edge) => edge.id));
  const seedNodes = new Set(seeds.filter((id) => !edgeIds.has(id)));
  const trace: Trace = {
    nodes: new Set(seedNodes),
    edges: new Set(seeds.filter((id) => edgeIds.has(id))),
  };

  switch (highlight) {
    case "neighbours":
      for (const edge of edges)
        if (seedNodes.has(edge.from) || seedNodes.has(edge.to)) trace.edges.add(edge.id);
      return trace;
    case "upstream":
      walk(edges, seedNodes, false, trace);
      return trace;
    case "downstream":
      walk(edges, seedNodes, true, trace);
      return trace;
    case "both":
      walk(edges, seedNodes, false, trace);
      walk(edges, seedNodes, true, trace);
      return trace;
    default:
      return assertNever(highlight, "Unhandled highlight");
  }
};
