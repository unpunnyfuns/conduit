import { describe, expect, it } from "vitest";
import { EDGE_LEVELS, pulseDurationFor } from "../../src/components/pulse.js";
import { PULSE_DURATION } from "../../src/layout/design.js";

describe("pulseDurationFor", () => {
  it("falls back to the default without a rate", () => {
    expect(pulseDurationFor(undefined)).toBe(PULSE_DURATION);
    expect(pulseDurationFor(0)).toBe(PULSE_DURATION);
    expect(pulseDurationFor(-5)).toBe(PULSE_DURATION);
    expect(pulseDurationFor(Number.NaN)).toBe(PULSE_DURATION);
  });

  it("clamps an infinite rate to the floor", () => {
    expect(pulseDurationFor(Number.POSITIVE_INFINITY)).toBe(0.6);
  });

  it("maps a rate to a clamped period", () => {
    expect(pulseDurationFor(100)).toBe(1.6);
    expect(pulseDurationFor(1000)).toBe(0.6);
    expect(pulseDurationFor(10)).toBe(3);
    expect(pulseDurationFor(200)).toBe(0.8);
  });
});

describe("EDGE_LEVELS", () => {
  it("lists the five levels in order", () => {
    expect(EDGE_LEVELS).toEqual(["live", "idle", "done", "stale", "down"]);
  });
});
