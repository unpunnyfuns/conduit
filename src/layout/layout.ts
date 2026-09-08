import type { Edge, ConduitDocument, View, ViewScope } from "../schema/document.js";
import type { Direction, Status } from "../schema/primitives.js";
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
import { curveBounds, pathOf, shiftCurve, transposeCurve, type Curve } from "./edges.js";
import { ConduitLayoutError } from "./errors.js";
import { frameFor } from "./frame.js";
import { roundCoord, transposeBox, type Box } from "./geometry.js";
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
  direction: Direction;
  lanes: PlacedLane[];
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  atlas: Atlas;
};

const WHOLE_DOCUMENT: ViewScope = { kind: "all" };

const requireView = (views: readonly View[], id: string): View => {
  const view = findView(views, id);
  if (view === undefined)
    throw new ConduitLayoutError("UNKNOWN_VIEW", `this document has no view '${id}'`);
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
export const layout = (doc: ConduitDocument, options: LayoutOptions = {}): Layout => {
  const heights: CardHeights = { ...DEFAULT_CARD_HEIGHTS, ...options.cardHeights };
  const view = options.view === undefined ? undefined : requireView(doc.views, options.view);
  const graph = resolveScope(doc, view?.scope ?? WHOLE_DOCUMENT);
  if (graph.nodes.length === 0)
    throw new ConduitLayoutError("NOTHING_TO_RENDER", "no nodes are in scope for this view");

  const frame = frameFor(doc.direction, graph, heights);
  const { layout: placed, routed } = relieveCongestion(graph, frame);

  const swapped = frame.direction === "down";
  const pills = placeLabelPills(routed, swapped);

  const orient = (box: Box): Box => (swapped ? transposeBox(box) : box);
  const orientCurve = (curve: Curve): Curve => (swapped ? transposeCurve(curve) : curve);

  const lanesInFrame = placed.lanes.map((lane) => ({ ...lane, box: orient(lane.box) }));
  const nodesInFrame = placed.nodes.map((node) => ({ ...node, box: orient(node.box) }));
  const curves = new Map(routed.map(({ edge, curve }) => [edge.id, orientCurve(curve)]));
  const pillBoxes = new Map([...pills].map(([id, box]) => [id, orient(box)]));
  const extent = swapped ? { width: placed.height, height: placed.width } : placed;

  const drawn: Box[] = [
    ...lanesInFrame.map(({ box }) => box),
    ...nodesInFrame.flatMap((node) => {
      const strip = badgeStrip(node);
      return strip === undefined ? [node.box] : [node.box, strip];
    }),
    ...pillBoxes.values(),
    ...[...curves.values()].map(curveBounds),
  ];
  const canvas = canvasFor(extent, union(drawn), DIAGRAM_MARGIN);

  const lanes = lanesInFrame.map((lane) => ({ ...lane, box: shiftBox(lane.box, canvas) }));
  const nodes = nodesInFrame.map((node) => ({ ...node, box: shiftBox(node.box, canvas) }));

  const edgeBoxes: Record<string, Box> = {};
  const edges: PlacedEdge[] = routed.map(({ edge }) => {
    const curve = curves.get(edge.id) ?? { from: { x: 0, y: 0 }, segments: [] };
    edgeBoxes[edge.id] = shiftBox(curveBounds(curve), canvas);
    const pill = pillBoxes.get(edge.id);
    return {
      edge,
      path: pathOf(shiftCurve(curve, canvas.shiftX, canvas.shiftY)),
      tone: edge.status,
      ...(pill === undefined || edge.label === undefined
        ? {}
        : { label: { text: edge.label, box: shiftBox(pill, canvas) } }),
    };
  });

  return {
    width: canvas.width,
    height: canvas.height,
    direction: doc.direction,
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
