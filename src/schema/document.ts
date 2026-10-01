import { z } from "zod";
import {
  Direction,
  EdgeEmphasis,
  EdgeKind,
  Id,
  Label,
  NodeKind,
  Status,
  Summary,
} from "./primitives.js";

export const Lane = z.strictObject({
  id: Id,
  label: Label,
  subtitle: Label.optional(),
  order: z.int().min(0).max(64).optional(),
  status: Status.default("neutral"),
  summary: Summary.optional(),
});
export type Lane = z.infer<typeof Lane>;

export const Badge = z.strictObject({
  label: Label.max(32),
  tone: Status.default("neutral"),
});
export type Badge = z.infer<typeof Badge>;

/**
 * `compact` is the header alone; `chart` reserves a body slot; a number is a
 * height in px, no shorter than a compact card's own height.
 */
export const NodeSize = z.union([
  z.literal("compact"),
  z.literal("chart"),
  z.number().min(52).max(1000),
]);
export type NodeSize = z.infer<typeof NodeSize>;

export const ConduitNode = z.strictObject({
  id: Id,
  label: Label,
  kind: NodeKind,
  lane: Id,
  row: z.int().min(0).max(256).optional(),
  group: Id.optional(),
  subtitle: Label.optional(),
  summary: Summary.optional(),
  status: Status.default("neutral"),
  badges: z.array(Badge).max(6).default([]),
  size: NodeSize.default("compact"),
});
export type ConduitNode = z.infer<typeof ConduitNode>;

export const Edge = z.strictObject({
  id: Id,
  from: Id,
  to: Id,
  kind: EdgeKind,
  label: Label.optional(),
  emphasis: EdgeEmphasis.default("normal"),
  animated: z.boolean().default(false),
  status: Status.default("neutral"),
  summary: Summary.optional(),
});
export type Edge = z.infer<typeof Edge>;

/**
 * "All" and "a selection" are distinct states rather than "a selection that
 * happens to be empty", so removing the last element a view pointed at can
 * never silently turn it into a view of everything.
 */
export const ViewScope = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("all") }),
  z
    .strictObject({
      kind: z.literal("selection"),
      lanes: z.array(Id).max(64).default([]),
      nodes: z.array(Id).max(256).default([]),
      edges: z.array(Id).max(512).default([]),
    })
    .refine((scope) => scope.lanes.length + scope.nodes.length + scope.edges.length > 0, {
      message: "a selection must name at least one element",
    }),
]);
export type ViewScope = z.infer<typeof ViewScope>;

export type View = {
  id: string;
  title: string;
  summary?: string;
  scope: ViewScope;
  children: View[];
};

export type ViewInput = {
  id: string;
  title: string;
  summary?: string;
  scope?:
    | { kind: "all" }
    | { kind: "selection"; lanes?: string[]; nodes?: string[]; edges?: string[] };
  children?: ViewInput[];
};

export const View: z.ZodType<View, ViewInput> = z.lazy(() =>
  z.strictObject({
    id: Id,
    title: Label,
    summary: Summary.optional(),
    scope: ViewScope.default({ kind: "all" }),
    children: z.array(View).max(32).default([]),
  }),
);

export const ConduitDocument = z.strictObject({
  version: z.literal(1),
  title: Label,
  summary: Summary.optional(),
  direction: Direction.default("right"),
  lanes: z.array(Lane).min(1).max(16),
  nodes: z.array(ConduitNode).min(1).max(256),
  edges: z.array(Edge).max(512).default([]),
  views: z.array(View).max(32).default([]),
});
export type ConduitDocument = z.infer<typeof ConduitDocument>;
export type ConduitDocumentInput = z.input<typeof ConduitDocument>;
