import type { Lane, ConduitNode } from "../schema/document.js";
import { CARD_GAP_X, DIAGRAM_MARGIN, LANE_GAP, LANE_TOP, ROW_GAP } from "./design.js";
import type { Frame } from "./frame.js";
import type { Box } from "./geometry.js";
import { orderLanes } from "./lanes.js";
import type { ScopedGraph } from "./scope.js";
import { seatNodes } from "./seating.js";

export { cardHeight, orderLanes } from "./lanes.js";

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
 *
 * Frame space: for a `"down"` document these become horizontal and vertical
 * on screen after `layout()` transposes.
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

/**
 * Lanes as columns along x, rows going down y — always. Which screen axis
 * each of those becomes is the frame's business, and `layout()` transposes
 * afterwards when the document flows the other way.
 */
export const layoutArchitecture = (
  graph: ScopedGraph,
  frame: Frame,
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

  const laneBoxWidth = frame.crossStart + frame.laneCross + frame.crossEnd;
  const contentTop = LANE_TOP + frame.alongStart;

  const gridHeights = new Map<number, number>();
  for (const { rows } of lanes)
    for (const { grid, nodes } of rows) {
      const height = Math.max(...nodes.map((node) => frame.along(node)));
      gridHeights.set(grid, Math.max(gridHeights.get(grid) ?? 0, height));
    }

  const gridRows: { top: number; height: number }[] = [];
  let cursor = contentTop;
  for (let grid = 0; grid < seating.rowCount; grid += 1) {
    if (grid > 0) cursor += bandExtra(grid);
    const height = gridHeights.get(grid) ?? 0;
    gridRows.push({ top: cursor, height });
    cursor += height + ROW_GAP;
  }
  const contentBottom = cursor - ROW_GAP;

  const laneBottom = contentBottom + frame.alongEnd + bandExtra(seating.rowCount);
  const placedLanes: PlacedLane[] = [];
  const placedNodes: PlacedNode[] = [];
  let laneX = DIAGRAM_MARGIN;

  lanes.forEach(({ lane, rows }, laneIndex) => {
    laneX += corridorExtra(laneIndex);
    const contentX = laneX + frame.crossStart;

    placedLanes.push({
      lane,
      box: { x: laneX, y: LANE_TOP, width: laneBoxWidth, height: laneBottom - LANE_TOP },
    });

    for (const row of rows) {
      const top = gridRows[row.grid]?.top ?? contentTop;
      const widths = frame.crossSplit(row);

      let x = contentX;
      row.nodes.forEach((node, index) => {
        const width = widths[index] ?? frame.laneCross;
        placedNodes.push({
          node,
          box: { x, y: top, width, height: frame.along(node) },
          row: row.grid,
          laneIndex,
        });
        x += width + CARD_GAP_X;
      });
    }

    laneX += laneBoxWidth + LANE_GAP;
  });

  const corridors = placedLanes.map(({ box }, index) => ({
    left: box.x - LANE_GAP - frame.crossEnd - corridorExtra(index),
    right: box.x + frame.crossStartRoutable,
  }));
  const lastContentRight =
    (placedLanes[placedLanes.length - 1]?.box.x ?? DIAGRAM_MARGIN) +
    frame.crossStart +
    frame.laneCross;
  corridors.push({
    left: lastContentRight,
    right:
      lastContentRight +
      frame.crossEnd +
      LANE_GAP +
      frame.crossStartRoutable +
      corridorExtra(placedLanes.length),
  });

  return {
    width: Math.ceil(laneX - LANE_GAP + DIAGRAM_MARGIN),
    height: Math.ceil(laneBottom + DIAGRAM_MARGIN),
    lanes: placedLanes,
    nodes: placedNodes,
    grid: { rows: gridRows, corridors, laneBottom },
  };
};
