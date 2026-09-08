import type { Edge, LensDocument, View, ViewScope } from "../schema/document.js";
import type { Status } from "../schema/primitives.js";
import type { PlacedLane, PlacedNode } from "./architecture.js";
import { canvasFor, union, type Canvas } from "./bounds.js";
import { relieveCongestion } from "./congestion.js";
import {
  BADGE_HEIGHT,
  BADGE_RISE,
  DEFAULT_CARD_HEIGHTS,
  DIAGRAM_MARGIN,
  type CardHeights,
} from "./design.js";
import { curveBounds, pathOf, shiftCurve } from "./edges.js";
import { LensLayoutError } from "./errors.js";
import { roundCoord, type Box } from "./geometry.js";
import { placeLabelPills } from "./labels.js";
import { findView, resolveScope } from "./scope.js";

export type LayoutOptions = {
  /** Id of the view to draw. Omitted draws the whole document. */
  view?: string;
  cardHeights?: Partial<CardHeights>;
};

export type PlacedEdge = {
  edge: Edge;
  /** SVG path data, already shifted onto the canvas. */
  path: string;
  tone: Status;
  label?: { text: string; box: Box };
};

export type Atlas = {
  lanes: Record<string, Box>;
  nodes: Record<string, Box>;
  edges: Record<string, Box>;
};

export type Layout = {
  width: number;
  height: number;
  lanes: PlacedLane[];
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  atlas: Atlas;
};

const WHOLE_DOCUMENT: ViewScope = { kind: "all" };

const requireView = (views: readonly View[], id: string): View => {
  const view = findView(views, id);
  if (view === undefined)
    throw new LensLayoutError("UNKNOWN_VIEW", `this document has no view '${id}'`);
  return view;
};

const shiftBox = (box: Box, canvas: Canvas): Box => ({
  x: roundCoord(box.x + canvas.shiftX),
  y: roundCoord(box.y + canvas.shiftY),
  width: roundCoord(box.width),
  height: roundCoord(box.height),
});

const badgeStrip = (placed: PlacedNode): Box | undefined =>
  placed.node.badges.length === 0
    ? undefined
    : {
        x: placed.box.x,
        y: placed.box.y - BADGE_RISE,
        width: placed.box.width,
        height: BADGE_HEIGHT,
      };

/**
 * A document in, every box out. Nothing here reads a clock, a font or a
 * random number: the same document and options produce the same geometry,
 * so a diagram never rearranges itself between two renders that barely
 * changed anything.
 */
export const layout = (doc: LensDocument, options: LayoutOptions = {}): Layout => {
  const heights: CardHeights = { ...DEFAULT_CARD_HEIGHTS, ...options.cardHeights };
  const view = options.view === undefined ? undefined : requireView(doc.views, options.view);
  const graph = resolveScope(doc, view?.scope ?? WHOLE_DOCUMENT);
  if (graph.nodes.length === 0)
    throw new LensLayoutError("NOTHING_TO_RENDER", "no nodes are in scope for this view");

  const { layout: placed, routed } = relieveCongestion(graph, heights);
  const pills = placeLabelPills(routed);

  const drawn: Box[] = [
    ...placed.lanes.map(({ box }) => box),
    ...placed.nodes.flatMap((node) => {
      const strip = badgeStrip(node);
      return strip === undefined ? [node.box] : [node.box, strip];
    }),
    ...pills.values(),
    ...routed.map(({ curve }) => curveBounds(curve)),
  ];
  const canvas = canvasFor(placed, union(drawn), DIAGRAM_MARGIN);

  const lanes = placed.lanes.map((lane) => ({ ...lane, box: shiftBox(lane.box, canvas) }));
  const nodes = placed.nodes.map((node) => ({ ...node, box: shiftBox(node.box, canvas) }));

  const edgeBoxes: Record<string, Box> = {};
  const edges: PlacedEdge[] = routed.map(({ edge, curve }) => {
    const shifted = shiftCurve(curve, canvas.shiftX, canvas.shiftY);
    edgeBoxes[edge.id] = shiftBox(curveBounds(curve), canvas);
    const pill = pills.get(edge.id);
    return {
      edge,
      path: pathOf(shifted),
      tone: edge.status,
      ...(pill === undefined || edge.label === undefined
        ? {}
        : { label: { text: edge.label, box: shiftBox(pill, canvas) } }),
    };
  });

  return {
    width: canvas.width,
    height: canvas.height,
    lanes,
    nodes,
    edges,
    atlas: {
      lanes: Object.fromEntries(lanes.map(({ lane, box }) => [lane.id, box])),
      nodes: Object.fromEntries(nodes.map(({ node, box }) => [node.id, box])),
      edges: edgeBoxes,
    },
  };
};
