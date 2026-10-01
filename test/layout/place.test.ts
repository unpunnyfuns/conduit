import { describe, expect, it } from "vitest";
import { placePopover, POPOVER_GAP, POPOVER_WIDTH } from "../../src/components/detail/place.js";

const canvas = { width: 1000, height: 600 };
const size = { width: POPOVER_WIDTH, height: 200 };

describe("placePopover", () => {
  it("sits to the right when it fits", () => {
    const box = placePopover({ x: 100, y: 100, width: 300, height: 52 }, size, canvas);
    expect(box).toEqual({ x: 100 + 300 + POPOVER_GAP, y: 100, width: POPOVER_WIDTH, height: 200 });
  });

  it("flips left when the right would overflow", () => {
    const box = placePopover({ x: 650, y: 100, width: 300, height: 52 }, size, canvas);
    expect(box.x).toBe(650 - POPOVER_GAP - POPOVER_WIDTH);
    expect(box.y).toBe(100);
  });

  it("drops below when neither side fits", () => {
    const narrow = { width: 500, height: 600 };
    const box = placePopover({ x: 50, y: 100, width: 400, height: 52 }, size, narrow);
    expect(box.y).toBe(100 + 52 + POPOVER_GAP);
    expect(box.x).toBe(50);
  });

  it("clamps at the bottom of the canvas", () => {
    const box = placePopover({ x: 100, y: 550, width: 300, height: 52 }, size, canvas);
    expect(box.y).toBe(600 - 200);
  });

  it("clamps a popover taller than the canvas to the top", () => {
    const box = placePopover(
      { x: 100, y: 300, width: 300, height: 52 },
      { width: POPOVER_WIDTH, height: 900 },
      canvas,
    );
    expect(box.y).toBe(0);
  });

  it("never returns negative coordinates", () => {
    const tiny = { width: 100, height: 100 };
    const box = placePopover({ x: 0, y: 0, width: 90, height: 52 }, size, tiny);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
  });
});
