import type { LensDocument, View } from "./document.js";
import type { SchemaIssue } from "./errors.js";

const duplicates = (ids: readonly string[]): string[] => {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) repeated.add(id);
    seen.add(id);
  }
  return [...repeated];
};

const flattenViews = (views: readonly View[], prefix: string): { view: View; path: string }[] =>
  views.flatMap((view, index) => {
    const path = `${prefix}[${index}]`;
    return [{ view, path }, ...flattenViews(view.children, `${path}.children`)];
  });

/**
 * Structural validation says a field holds an id; these checks say the id
 * points at something.
 */
export const integrityIssues = (doc: LensDocument): SchemaIssue[] => {
  const issues: SchemaIssue[] = [];
  const broken = (path: string, message: string) =>
    issues.push({ code: "BROKEN_REFERENCE", path, message });
  const duplicate = (path: string, message: string) =>
    issues.push({ code: "DUPLICATE_ID", path, message });

  const laneIds = new Set(doc.lanes.map((lane) => lane.id));
  const nodeIds = new Set(doc.nodes.map((node) => node.id));
  const edgeIds = new Set(doc.edges.map((edge) => edge.id));

  for (const id of duplicates(doc.lanes.map((lane) => lane.id)))
    duplicate("lanes", `duplicate lane id '${id}'`);
  for (const id of duplicates(doc.nodes.map((node) => node.id)))
    duplicate("nodes", `duplicate node id '${id}'`);
  for (const id of duplicates(doc.edges.map((edge) => edge.id)))
    duplicate("edges", `duplicate edge id '${id}'`);

  doc.nodes.forEach((node, index) => {
    if (!laneIds.has(node.lane))
      broken(`nodes[${index}].lane`, `node '${node.id}' references unknown lane '${node.lane}'`);
  });

  doc.edges.forEach((edge, index) => {
    if (!nodeIds.has(edge.from))
      broken(`edges[${index}].from`, `edge '${edge.id}' references unknown node '${edge.from}'`);
    if (!nodeIds.has(edge.to))
      broken(`edges[${index}].to`, `edge '${edge.id}' references unknown node '${edge.to}'`);
  });

  const views = flattenViews(doc.views, "views");
  for (const id of duplicates(views.map(({ view }) => view.id)))
    duplicate("views", `duplicate view id '${id}'`);

  for (const { view, path } of views) {
    if (view.scope.kind !== "selection") continue;
    view.scope.lanes.forEach((id, index) => {
      if (!laneIds.has(id))
        broken(
          `${path}.scope.lanes[${index}]`,
          `view '${view.id}' references unknown lane '${id}'`,
        );
    });
    view.scope.nodes.forEach((id, index) => {
      if (!nodeIds.has(id))
        broken(
          `${path}.scope.nodes[${index}]`,
          `view '${view.id}' references unknown node '${id}'`,
        );
    });
    view.scope.edges.forEach((id, index) => {
      if (!edgeIds.has(id))
        broken(
          `${path}.scope.edges[${index}]`,
          `view '${view.id}' references unknown edge '${id}'`,
        );
    });
  }

  return issues;
};
