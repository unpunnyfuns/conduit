import { z } from "zod";

/** Constrained so an id survives as a DOM id, an SVG marker id and a URL fragment. */
export const Id = z
  .string()
  .min(1)
  .max(128)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/,
    "must start alphanumeric and contain only letters, digits and . _ : / -",
  );
export type Id = z.infer<typeof Id>;

export const Label = z.string().min(1).max(120);
export const Summary = z.string().min(1).max(2000);

export const Status = z.enum(["neutral", "positive", "caution", "critical"]);
export type Status = z.infer<typeof Status>;
export const STATUSES = Status.options;

/** Coarse on purpose: this drives the card icon, never analysis. */
export const NodeKind = z.enum([
  "service",
  "app",
  "module",
  "function",
  "route",
  "job",
  "queue",
  "datastore",
  "cache",
  "external",
  "ui",
  "config",
  "test",
  "package",
  "other",
]);
export type NodeKind = z.infer<typeof NodeKind>;

export const EdgeKind = z.enum([
  "call",
  "http",
  "rpc",
  "event",
  "queue",
  "data",
  "dependency",
  "render",
  "other",
]);
export type EdgeKind = z.infer<typeof EdgeKind>;

export const EdgeEmphasis = z.enum(["normal", "hero", "muted"]);
export type EdgeEmphasis = z.infer<typeof EdgeEmphasis>;

/** Which way the flow runs: lanes as columns with rows going down, or lanes as bands with columns going right. */
export const Direction = z.enum(["right", "down"]);
export type Direction = z.infer<typeof Direction>;
