import {
  PULSE_DURATION,
  PULSE_DURATION_MAX,
  PULSE_DURATION_MIN,
  PULSE_RATE_SCALE,
} from "../layout/design.js";

/**
 * What a hop is doing right now, as the app sees it. Absent means "whatever
 * the document says". `done` is a hop that completed — a batch that ran —
 * as opposed to `idle`, which never started, and `stale`, which should have.
 */
export type EdgeLevel = "live" | "idle" | "done" | "stale" | "down";

export const EDGE_LEVELS: readonly EdgeLevel[] = ["live", "idle", "done", "stale", "down"];

export type EdgeState = {
  level: EdgeLevel;
  /** Messages per second, or any unit; only its magnitude sets the pulse period. */
  rate?: number;
};

/** Seconds per pulse cycle for a rate, clamped so extremes stay legible. */
export const pulseDurationFor = (rate?: number): number => {
  if (rate === undefined || !(rate > 0)) return PULSE_DURATION;
  const raw = PULSE_RATE_SCALE / rate;
  return Math.round(Math.min(PULSE_DURATION_MAX, Math.max(PULSE_DURATION_MIN, raw)) * 100) / 100;
};
