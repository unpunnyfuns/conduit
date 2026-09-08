import type { Lane, ConduitNode } from "../schema/document.js";
import {
  CARD_GAP_X,
  CONTENT_TOP,
  DIAGRAM_MARGIN,
  LANE_BOTTOM_PADDING,
  LANE_CONTENT_WIDTH,
  LANE_GAP,
  LANE_PADDING_X,
  LANE_TOP,
  ROW_GAP,
  type CardHeights,
} from "./design.js";
import type { Box } from "./geometry.js";
import type { ScopedGraph } from "./scope.js";
import { seatNodes, type SeatedRow } from "./seating.js";

export type PlacedNode = {
  node: ConduitNode;
  box: Box;
  row: number;
  laneIndex: number;
};

export type PlacedLane = { lane: Lane; box: Box };

/**
 * The gaps of the grid, for the router: the vertical corridors beside each
 * lane's cards and the horizontal extents of every row. Corridor `i` runs to
 * the left of lane `i`; one extra corridor sits after the last lane.
 */
export type LayoutGrid = {
  rows: { top: number; height: number }[];
  corridors: { left: number; right: number }[];
  /** Where lane content ends — the floor of the last band under the last row. */
  laneBottom: number;
};

/**
 * Extra room granted to individual gaps, keyed by corridor or band index —
 * how the layout widens where traffic would otherwise compress track pitch
 * through the floor. Expanding a corridor moves every lane after it sideways
 * by the same amount; expanding a band moves every row after it down. Cards
 * travel with their lane and row — nothing re-seats, nothing reorders.
 */
export type GapExpansions = {
  corridors: ReadonlyMap<number, number>;
  bands: ReadonlyMap<number, number>;
};

export type ArchitectureLayout = {
  width: number;
  height: number;
  lanes: PlacedLane[];
  nodes: PlacedNode[];
  grid: LayoutGrid;
};

export const cardHeight = (node: ConduitNode, heights: CardHeights): number => {
  if (typeof node.size === "number") return node.size;
  if (node.size === "chart") return heights.chart;
  return node.subtitle === undefined ? heights.compact : heights.withSubtitle;
};

const orderLanes = (lanes: readonly Lane[]): Lane[] =>
  lanes
    .map((lane, index) => ({ lane, index }))
    .sort(
      (a, b) =>
        (a.lane.order ?? Number.MAX_SAFE_INTEGER) - (b.lane.order ?? Number.MAX_SAFE_INTEGER) ||
        a.index - b.index,
    )
    .map(({ lane }) => lane);

/**
 * A pair divides its row into equal halves. Splitting in proportion to what
 * each card's text asked for would mean a rename moves its neighbour.
 */
const rowWidths = (contentWidth: number, row: SeatedRow): number[] => {
  if (row.nodes.length < 2) return [contentWidth];
  const half = Math.round((contentWidth - CARD_GAP_X) / 2);
  return [half, contentWidth - CARD_GAP_X - half];
};

export const layoutArchitecture = (
  graph: ScopedGraph,
  heights: CardHeights,
  expansions?: GapExpansions,
): ArchitectureLayout => {
  const corridorExtra = (index: number): number => expansions?.corridors.get(index) ?? 0;
  const bandExtra = (index: number): number => expansions?.bands.get(index) ?? 0;

  const ordered = orderLanes(graph.lanes);
  const seating = seatNodes(ordered, graph.nodes, graph.edges);

  const lanes = ordered.flatMap((lane) => {
    const rows = seating.rowsByLane.get(lane.id);
    return rows === undefined ? [] : [{ lane, rows }];
  });

  const laneBoxWidth = LANE_CONTENT_WIDTH + LANE_PADDING_X * 2;

  const gridHeights = new Map<number, number>();
  for (const { rows } of lanes)
    for (const { grid, nodes } of rows) {
      const height = Math.max(...nodes.map((node) => cardHeight(node, heights)));
      gridHeights.set(grid, Math.max(gridHeights.get(grid) ?? 0, height));
    }

  const gridRows: { top: number; height: number }[] = [];
  let cursor = CONTENT_TOP;
  for (let grid = 0; grid < seating.rowCount; grid += 1) {
    if (grid > 0) cursor += bandExtra(grid);
    const height = gridHeights.get(grid) ?? 0;
    gridRows.push({ top: cursor, height });
    cursor += height + ROW_GAP;
  }
  const contentBottom = cursor - ROW_GAP;

  const laneBottom = contentBottom + LANE_BOTTOM_PADDING + bandExtra(seating.rowCount);
  const placedLanes: PlacedLane[] = [];
  const placedNodes: PlacedNode[] = [];
  let laneX = DIAGRAM_MARGIN;

  lanes.forEach(({ lane, rows }, laneIndex) => {
    laneX += corridorExtra(laneIndex);
    const contentX = laneX + LANE_PADDING_X;

    placedLanes.push({
      lane,
      box: { x: laneX, y: LANE_TOP, width: laneBoxWidth, height: laneBottom - LANE_TOP },
    });

    for (const row of rows) {
      const top = gridRows[row.grid]?.top ?? CONTENT_TOP;
      const widths = rowWidths(LANE_CONTENT_WIDTH, row);

      let x = contentX;
      row.nodes.forEach((node, index) => {
        const width = widths[index] ?? LANE_CONTENT_WIDTH;
        placedNodes.push({
          node,
          box: { x, y: top, width, height: cardHeight(node, heights) },
          row: row.grid,
          laneIndex,
        });
        x += width + CARD_GAP_X;
      });
    }

    laneX += laneBoxWidth + LANE_GAP;
  });

  const gutter = LANE_PADDING_X * 2 + LANE_GAP;
  const corridors = placedLanes.map(({ box }, index) => ({
    left: box.x + LANE_PADDING_X - gutter - corridorExtra(index),
    right: box.x + LANE_PADDING_X,
  }));
  const lastContentRight =
    (placedLanes[placedLanes.length - 1]?.box.x ?? DIAGRAM_MARGIN) +
    LANE_PADDING_X +
    LANE_CONTENT_WIDTH;
  corridors.push({
    left: lastContentRight,
    right: lastContentRight + gutter + corridorExtra(placedLanes.length),
  });

  return {
    width: Math.ceil(laneX - LANE_GAP + DIAGRAM_MARGIN),
    height: Math.ceil(laneBottom + DIAGRAM_MARGIN),
    lanes: placedLanes,
    nodes: placedNodes,
    grid: { rows: gridRows, corridors, laneBottom },
  };
};
