import type { Box } from "../../layout/geometry.js";

export type Size = { width: number; height: number };

export const POPOVER_WIDTH = 280;
export const POPOVER_GAP = 12;

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value));

/**
 * Where a popover goes for an anchor: beside it on the right when that fits
 * in the canvas, else beside it on the left, else under it — then held
 * inside the canvas. A popover taller than the canvas sits at the top.
 */
export const placePopover = (anchor: Box, size: Size, canvas: Size): Box => {
  const right = anchor.x + anchor.width + POPOVER_GAP;
  const left = anchor.x - POPOVER_GAP - size.width;
  const candidate =
    right + size.width <= canvas.width
      ? { x: right, y: anchor.y }
      : left >= 0
        ? { x: left, y: anchor.y }
        : { x: anchor.x, y: anchor.y + anchor.height + POPOVER_GAP };

  return {
    x: clamp(candidate.x, 0, Math.max(0, canvas.width - size.width)),
    y: clamp(candidate.y, 0, Math.max(0, canvas.height - size.height)),
    width: size.width,
    height: size.height,
  };
};
