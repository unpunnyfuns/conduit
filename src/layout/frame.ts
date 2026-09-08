import type { ConduitNode } from "../schema/document.js";
import type { Direction } from "../schema/primitives.js";
import { cardHeight, orderLanes } from "./architecture.js";
import {
  CARD_GAP_X,
  LANE_BOTTOM_PADDING,
  LANE_CONTENT_WIDTH,
  LANE_GAP,
  LANE_HEADER_STRIP,
  LANE_PADDING_X,
  ROW_GAP,
  type CardHeights,
} from "./design.js";
import type { ScopedGraph } from "./scope.js";
import { seatNodes, type SeatedRow } from "./seating.js";

/**
 * The numbers the engine lays out with, for one direction.
 *
 * The engine always thinks in its own frame: lanes are columns along x, rows
 * go down y. "Cross" is x in that frame — across the lane — and "along" is y,
 * the direction the flow runs. A frame for `"down"` hands the engine the
 * transposed numbers; `layout()` swaps the axes back afterwards.
 */
export type Frame = {
  direction: Direction;
  /** Width of every lane's content, frame x. Constant across lanes so nothing shifts its neighbour. */
  laneCross: number;
  /** Padding inside a lane before and after its content, frame x. */
  crossStart: number;
  crossEnd: number;
  /** How much of `crossStart`, measured from the lane's edge, a route may run through. */
  crossStartRoutable: number;
  /** Room inside a lane before the first row and after the last, frame y. */
  alongStart: number;
  alongEnd: number;
  /** Frame-y extent of a card. */
  along: (node: ConduitNode) => number;
  /** Frame-x extents of one row's cards, in row order, summing with gaps to at most `laneCross`. */
  crossSplit: (row: SeatedRow) => number[];
  /** Physical width of a corridor between lanes and of a band between rows, for congestion relief. */
  corridorWidth: number;
  bandWidth: number;
};

const halves = (contentWidth: number): number[] => {
  const half = Math.round((contentWidth - CARD_GAP_X) / 2);
  return [half, contentWidth - CARD_GAP_X - half];
};

/**
 * The tallest stack of cards any row holds, so every band can be the same
 * height. Never shorter than a compact card, so an empty-looking band still
 * reads as a lane.
 */
const tallestRow = (graph: ScopedGraph, heights: CardHeights): number => {
  const seating = seatNodes(orderLanes(graph.lanes), graph.nodes, graph.edges);
  let tallest = heights.compact;
  for (const rows of seating.rowsByLane.values())
    for (const row of rows) {
      const stacked =
        row.nodes.reduce((sum, node) => sum + cardHeight(node, heights), 0) +
        CARD_GAP_X * (row.nodes.length - 1);
      tallest = Math.max(tallest, stacked);
    }
  return tallest;
};

export const frameFor = (direction: Direction, graph: ScopedGraph, heights: CardHeights): Frame => {
  switch (direction) {
    case "right":
      return {
        direction,
        laneCross: LANE_CONTENT_WIDTH,
        crossStart: LANE_PADDING_X,
        crossEnd: LANE_PADDING_X,
        crossStartRoutable: LANE_PADDING_X,
        alongStart: LANE_HEADER_STRIP,
        alongEnd: LANE_BOTTOM_PADDING,
        along: (node) => cardHeight(node, heights),
        crossSplit: (row) =>
          row.nodes.length < 2 ? [LANE_CONTENT_WIDTH] : halves(LANE_CONTENT_WIDTH),
        corridorWidth: LANE_PADDING_X + LANE_GAP + LANE_PADDING_X,
        bandWidth: ROW_GAP,
      };
    case "down":
      return {
        direction,
        laneCross: tallestRow(graph, heights),
        crossStart: LANE_HEADER_STRIP,
        crossEnd: LANE_BOTTOM_PADDING,
        crossStartRoutable: LANE_PADDING_X,
        alongStart: LANE_PADDING_X,
        alongEnd: LANE_PADDING_X,
        along: () => LANE_CONTENT_WIDTH,
        crossSplit: (row) => row.nodes.map((node) => cardHeight(node, heights)),
        corridorWidth: LANE_BOTTOM_PADDING + LANE_GAP + LANE_PADDING_X,
        bandWidth: ROW_GAP,
      };
  }
};
