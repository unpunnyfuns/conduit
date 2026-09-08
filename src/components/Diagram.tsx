import { useMemo, type ReactNode } from "react";
import type { LensDocument, LensNode } from "../schema/document.js";
import { cn } from "../cn.js";
import { DEFAULT_CARD_HEIGHTS, type CardHeights } from "../layout/design.js";
import { layout } from "../layout/layout.js";
import { Card } from "./Card.js";
import { EdgeLayer } from "./EdgeLayer.js";
import { LaneBand } from "./Lane.js";

export type DiagramProps = {
  doc: LensDocument;
  /** Id of a view to draw. Omitted draws the whole document. */
  view?: string;
  /** Ids of lanes, nodes or edges to keep lit; everything else dims. */
  selected?: readonly string[];
  onNodeClick?: (id: string) => void;
  onEdgeClick?: (id: string) => void;
  cardHeights?: Partial<CardHeights>;
  className?: string;
  /** Fills the body slot of every card that has one. */
  children?: (node: LensNode) => ReactNode;
};

const headerHeightOf = (node: LensNode, heights: CardHeights): number =>
  node.subtitle === undefined ? heights.compact : heights.withSubtitle;

/**
 * The diagram: lanes underneath, one svg of edges, cards on top. Layout is
 * pure and memoised on its inputs, so a chart re-rendering inside a card
 * never triggers a relayout.
 */
export const Diagram = ({
  doc,
  view,
  selected,
  onNodeClick,
  onEdgeClick,
  cardHeights,
  className,
  children,
}: DiagramProps) => {
  const heights = useMemo<CardHeights>(
    () => ({ ...DEFAULT_CARD_HEIGHTS, ...cardHeights }),
    [cardHeights],
  );
  const laid = useMemo(() => layout(doc, { view, cardHeights: heights }), [doc, view, heights]);

  const lit = useMemo(() => {
    if (selected === undefined || selected.length === 0) return undefined;
    const ids = new Set(selected);
    const nodes = new Set(
      laid.nodes.filter(({ node }) => ids.has(node.id)).map(({ node }) => node.id),
    );
    const edges = new Set(
      laid.edges
        .filter(({ edge }) => ids.has(edge.id) || nodes.has(edge.from) || nodes.has(edge.to))
        .map(({ edge }) => edge.id),
    );
    const lanes = new Set(
      laid.lanes
        .filter(
          ({ lane }) =>
            ids.has(lane.id) ||
            laid.nodes.some(({ node }) => node.lane === lane.id && nodes.has(node.id)),
        )
        .map(({ lane }) => lane.id),
    );
    return { nodes, edges, lanes };
  }, [selected, laid]);

  const dimmedEdges = useMemo(
    () =>
      new Set(
        lit === undefined
          ? []
          : laid.edges.filter(({ edge }) => !lit.edges.has(edge.id)).map(({ edge }) => edge.id),
      ),
    [lit, laid],
  );

  const nodeLabel = new Map(laid.nodes.map(({ node }) => [node.id, node.label]));

  return (
    <div
      role="figure"
      aria-label={doc.title}
      className={cn(
        "relative overflow-hidden rounded-xl bg-lens-bg bg-[radial-gradient(var(--color-lens-dot)_1px,transparent_1px)] bg-[size:18px_18px] text-lens-fg",
        className,
      )}
      style={{ width: laid.width, height: laid.height }}
    >
      {laid.lanes.map(({ lane, box }) => (
        <LaneBand
          key={lane.id}
          id={lane.id}
          lane={lane}
          box={box}
          dimmed={lit !== undefined && !lit.lanes.has(lane.id)}
        />
      ))}

      <EdgeLayer
        width={laid.width}
        height={laid.height}
        edges={laid.edges}
        dimmedIds={dimmedEdges}
        onEdgeClick={onEdgeClick}
      />

      {laid.nodes.map(({ node, box }) => (
        <Card
          key={node.id}
          id={node.id}
          node={node}
          box={box}
          headerHeight={headerHeightOf(node, heights)}
          dimmed={lit !== undefined && !lit.nodes.has(node.id)}
          selected={selected?.includes(node.id) ?? false}
          onClick={onNodeClick === undefined ? undefined : () => onNodeClick(node.id)}
        >
          {children?.(node)}
        </Card>
      ))}

      <ul className="sr-only">
        {laid.edges.map(({ edge }) => (
          <li
            key={edge.id}
          >{`${nodeLabel.get(edge.from) ?? edge.from} → ${nodeLabel.get(edge.to) ?? edge.to}, ${edge.kind}`}</li>
        ))}
      </ul>
    </div>
  );
};
