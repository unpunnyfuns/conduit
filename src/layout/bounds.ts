import type { Box } from "./geometry.js";

/** The smallest box containing both of them. */
export const covering = (a: Box, b: Box): Box => {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);

  return { x: left, y: top, width: right - left, height: bottom - top };
};

/** The smallest box containing all of them, or nothing when there are none. */
export const union = (boxes: readonly Box[]): Box | undefined =>
  boxes.reduce<Box | undefined>(
    (grown, box) => (grown === undefined ? box : covering(grown, box)),
    undefined,
  );

export type Canvas = { width: number; height: number; shiftX: number; shiftY: number };

/**
 * A canvas big enough for everything that was drawn.
 *
 * Edge routes deliberately leave their lane, and a label pill can be pushed
 * past the last card in search of clear air, so the space the lanes occupy is
 * a floor rather than the answer. The canvas only ever grows: the margins the
 * design leaves above and beside the lanes are part of the design, not slack
 * to be reclaimed.
 */
export const canvasFor = (
  laid: { width: number; height: number },
  drawn: Box | undefined,
  margin: number,
): Canvas => {
  if (drawn === undefined) return { width: laid.width, height: laid.height, shiftX: 0, shiftY: 0 };

  const shiftX = Math.max(0, margin - drawn.x);
  const shiftY = Math.max(0, margin - drawn.y);

  return {
    width: Math.ceil(Math.max(laid.width, drawn.x + drawn.width + margin) + shiftX),
    height: Math.ceil(Math.max(laid.height, drawn.y + drawn.height + margin) + shiftY),
    shiftX,
    shiftY,
  };
};
