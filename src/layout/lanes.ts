import type { ConduitNode, Lane } from "../schema/document.js";
import type { CardHeights } from "./design.js";

export const cardHeight = (node: ConduitNode, heights: CardHeights): number => {
  if (typeof node.size === "number") return node.size;
  if (node.size === "chart") return heights.chart;
  return node.subtitle === undefined ? heights.compact : heights.withSubtitle;
};

export const orderLanes = (lanes: readonly Lane[]): Lane[] =>
  lanes
    .map((lane, index) => ({ lane, index }))
    .sort(
      (a, b) =>
        (a.lane.order ?? Number.MAX_SAFE_INTEGER) - (b.lane.order ?? Number.MAX_SAFE_INTEGER) ||
        a.index - b.index,
    )
    .map(({ lane }) => lane);
