import type { Edge, Lane, ConduitNode } from "../schema/document.js";
import { ConduitLayoutError } from "./errors.js";
import { rankNodes } from "./rank.js";

/** One occupied row of one lane: a single card, or two side by side. */
export type SeatedRow = { grid: number; nodes: ConduitNode[] };

export type Seating = {
  rowsByLane: Map<string, SeatedRow[]>;
  rowCount: number;
};

/**
 * Where every card sits: a row grid shared across all lanes.
 *
 * A node with an explicit `row` claims that grid row outright. Everything
 * else is ranked by its connections — longest path from a source — so an
 * arrow always points at a node below the one it left, and then falls to
 * the next row its lane has not already claimed. Seating reads connections,
 * explicit rows and document order, never a label, so a rename moves nothing.
 *
 * When no row is explicit, the ranks in use are compressed onto contiguous
 * rows, so a lane that enters the story late does not leave a hole above it.
 * Once any row is explicit the grid is absolute — an automatic node sits at
 * its rank — because a compressed row could land above the pinned card that
 * feeds it, and an arrow running back up the page is worse than a gap.
 */
export const seatNodes = (
  orderedLanes: readonly Lane[],
  nodes: readonly ConduitNode[],
  edges: readonly Edge[],
): Seating => {
  const laneIndex = new Map(orderedLanes.map((lane, index) => [lane.id, index]));
  const docIndex = new Map(nodes.map((node, index) => [node.id, index]));

  const pinnedRows: Record<string, number> = {};
  for (const node of nodes) if (node.row !== undefined) pinnedRows[node.id] = node.row;
  const anyPinned = Object.keys(pinnedRows).length > 0;

  const ranks = rankNodes(nodes, edges, pinnedRows);
  const rowOfRank = anyPinned ? identityRows(ranks) : compressRanks(nodes, ranks);
  const keys = barycenters(nodes, edges, ranks, laneIndex);

  const rowsByLane = new Map<string, SeatedRow[]>();
  let lastRow = -1;

  for (const lane of orderedLanes) {
    const members = nodes.filter((node) => node.lane === lane.id);
    if (members.length === 0) continue;

    const pinned = pinRows(members.filter((node) => node.row !== undefined));
    const claimed = new Set(pinned.map((row) => row.grid));
    const automatic = seatLane(
      members.filter((node) => node.row === undefined),
      ranks,
      rowOfRank,
      keys,
      docIndex,
      claimed,
    );

    const rows = [...pinned, ...automatic].sort((a, b) => a.grid - b.grid);
    rowsByLane.set(lane.id, rows);
    lastRow = Math.max(lastRow, rows[rows.length - 1]?.grid ?? -1);
  }

  return { rowsByLane, rowCount: lastRow + 1 };
};

/** Rank values in use, in order, mapped onto contiguous rows. */
const compressRanks = (
  nodes: readonly ConduitNode[],
  ranks: ReadonlyMap<string, number>,
): Map<number, number> => {
  const used = [...new Set(nodes.map((node) => ranks.get(node.id) ?? 0))].sort((a, b) => a - b);
  return new Map(used.map((rank, index) => [rank, index]));
};

const identityRows = (ranks: ReadonlyMap<string, number>): Map<number, number> =>
  new Map([...new Set(ranks.values())].map((rank) => [rank, rank]));

/** Explicit rows, grouped: a row holds at most two cards, in array order. */
const pinRows = (pinned: readonly ConduitNode[]): SeatedRow[] => {
  const byRow = new Map<number, ConduitNode[]>();
  for (const node of pinned) {
    const grid = node.row ?? 0;
    const list = byRow.get(grid) ?? [];
    list.push(node);
    byRow.set(grid, list);
  }

  return [...byRow.entries()]
    .sort(([a], [b]) => a - b)
    .map(([grid, members]) => {
      if (members.length > 2)
        throw new ConduitLayoutError(
          "ROW_OVERFULL",
          `lane '${members[0]?.lane}' row ${grid} holds ${members.length} nodes; a row holds at most two`,
        );
      return { grid, nodes: members };
    });
};

type Barycenters = {
  /** Mean rank of a card's partners: decides who falls when a rank collides. */
  fall: Map<string, number>;
  /** Mean lane of a card's partners: decides who sits left in a shared row. */
  side: Map<string, number>;
};

const barycenters = (
  nodes: readonly ConduitNode[],
  edges: readonly Edge[],
  ranks: ReadonlyMap<string, number>,
  laneIndex: ReadonlyMap<string, number>,
): Barycenters => {
  const laneOf = new Map(nodes.map((node) => [node.id, laneIndex.get(node.lane) ?? 0]));
  const partners = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (edge.from === edge.to || !laneOf.has(edge.from) || !laneOf.has(edge.to)) continue;
    partners.get(edge.from)?.push(edge.to);
    partners.get(edge.to)?.push(edge.from);
  }

  const fall = new Map<string, number>();
  const side = new Map<string, number>();
  for (const node of nodes) {
    const linked = partners.get(node.id) ?? [];
    fall.set(node.id, mean(linked.map((id) => ranks.get(id) ?? 0)) ?? ranks.get(node.id) ?? 0);
    side.set(node.id, mean(linked.map((id) => laneOf.get(id) ?? 0)) ?? laneOf.get(node.id) ?? 0);
  }
  return { fall, side };
};

const mean = (values: readonly number[]): number | undefined =>
  values.length === 0 ? undefined : values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * One lane's automatic members onto the shared grid.
 *
 * A card sits at its rank's row unless an earlier card of the same lane
 * already claimed it — by rank or by an explicit row — in which case it falls
 * to the next free one. Two cards share a row only at the same rank in the
 * same sub-group. Who falls, and who sits left in a pair, is decided by where
 * each card's partners are, with document order as the stable tiebreak.
 */
const seatLane = (
  members: readonly ConduitNode[],
  ranks: ReadonlyMap<string, number>,
  rowOfRank: ReadonlyMap<number, number>,
  keys: Barycenters,
  docIndex: ReadonlyMap<string, number>,
  claimed: ReadonlySet<number>,
): SeatedRow[] => {
  const doc = (node: ConduitNode): number => docIndex.get(node.id) ?? 0;
  const sorted = [...members].sort((a, b) => {
    const row =
      (rowOfRank.get(ranks.get(a.id) ?? 0) ?? 0) - (rowOfRank.get(ranks.get(b.id) ?? 0) ?? 0);
    if (row !== 0) return row;
    const fall = (keys.fall.get(a.id) ?? 0) - (keys.fall.get(b.id) ?? 0);
    if (fall !== 0) return fall;
    return doc(a) - doc(b);
  });

  const rows: { grid: number; rank: number; nodes: ConduitNode[] }[] = [];
  let previous = -1;

  for (const node of sorted) {
    const rank = ranks.get(node.id) ?? 0;
    const open = rows[rows.length - 1];

    if (
      open !== undefined &&
      open.nodes.length === 1 &&
      open.rank === rank &&
      (open.nodes[0]?.group ?? "") === (node.group ?? "")
    ) {
      const first = open.nodes[0];
      if (first !== undefined && leansLeft(node, first, keys, doc)) open.nodes.unshift(node);
      else open.nodes.push(node);
      continue;
    }

    previous = Math.max(previous + 1, rowOfRank.get(rank) ?? 0);
    while (claimed.has(previous)) previous += 1;
    rows.push({ grid: previous, rank, nodes: [node] });
  }

  return rows.map(({ grid, nodes }) => ({ grid, nodes }));
};

const leansLeft = (
  node: ConduitNode,
  other: ConduitNode,
  keys: Barycenters,
  doc: (node: ConduitNode) => number,
): boolean => {
  const side = (keys.side.get(node.id) ?? 0) - (keys.side.get(other.id) ?? 0);
  if (side !== 0) return side < 0;
  return doc(node) < doc(other);
};
