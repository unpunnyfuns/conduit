import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ConduitDocument, ConduitNode } from "../schema/document.js";
import { cn } from "../cn.js";
import { DEFAULT_CARD_HEIGHTS, type CardHeights } from "../layout/design.js";
import { layout } from "../layout/layout.js";
import { traceFrom, type Highlight } from "../layout/trace.js";
import { Card } from "./Card.js";
import { EdgeLayer } from "./EdgeLayer.js";
import { LaneBand } from "./Lane.js";

export type DiagramProps = {
  doc: ConduitDocument;
  /** Id of a view to draw. Omitted draws the whole document. */
  view?: string;
  /** Ids of lanes, nodes or edges to keep lit; everything else dims. */
  selected?: readonly string[];
  /** What a selection lights: neighbours (default), everything upstream, downstream, or both. */
  highlight?: Highlight;
  onNodeClick?: (id: string) => void;
  onEdgeClick?: (id: string) => void;
  cardHeights?: Partial<CardHeights>;
  /** Applied to the scroll viewport; size it with `h-[…]` / `max-h-[…]` etc. */
  className?: string;
  /** Scales the canvas down to the viewport's width. Never scales up. */
  fit?: boolean;
  /** Fills the body slot of every card that has one. */
  children?: (node: ConduitNode) => ReactNode;
};

const headerHeightOf = (node: ConduitNode, heights: CardHeights): number =>
  node.subtitle === undefined ? heights.compact : heights.withSubtitle;

/**
 * The diagram: lanes underneath, one svg of edges, cards on top. Layout is
 * pure and memoised on its inputs, so a chart re-rendering inside a card
 * never triggers a relayout.
 *
 * The root (`role="figure"`) is a scroll viewport; the fixed-size drawing
 * itself is `[data-conduit-canvas]` inside it, scaled down to the viewport's
 * width when `fit` is set. Atlas coordinates from `layout()` are relative to
 * the canvas, not the viewport.
 */
export const Diagram = ({
  doc,
  view,
  selected,
  highlight = "neighbours",
  onNodeClick,
  onEdgeClick,
  cardHeights,
  className,
  fit = false,
  children,
}: DiagramProps) => {
  // Deps are the scalars, not `cardHeights` itself: a caller passing a fresh
  // object literal every render must not defeat the memo below it.
  const compactHeight = cardHeights?.compact;
  const withSubtitleHeight = cardHeights?.withSubtitle;
  const chartHeight = cardHeights?.chart;
  const heights = useMemo<CardHeights>(
    () => ({
      compact: compactHeight ?? DEFAULT_CARD_HEIGHTS.compact,
      withSubtitle: withSubtitleHeight ?? DEFAULT_CARD_HEIGHTS.withSubtitle,
      chart: chartHeight ?? DEFAULT_CARD_HEIGHTS.chart,
    }),
    [compactHeight, withSubtitleHeight, chartHeight],
  );

  const { laid, nodeLabel } = useMemo(() => {
    const drawn = layout(doc, { view, cardHeights: heights });
    const labels = new Map(drawn.nodes.map(({ node }) => [node.id, node.label]));
    return { laid: drawn, nodeLabel: labels };
  }, [doc, view, heights]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    if (!fit) return;
    const node = viewportRef.current;
    if (node === null || typeof ResizeObserver === "undefined") return;
    const update = () => setViewportWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [fit]);

  const scale = fit && viewportWidth > 0 ? Math.min(1, viewportWidth / laid.width) : 1;

  const lit = useMemo(() => {
    if (selected === undefined || selected.length === 0) return undefined;
    const trace = traceFrom(
      laid.edges.map(({ edge }) => edge),
      selected,
      highlight,
    );
    const ids = new Set(selected);
    const nodes = new Set(
      laid.nodes.filter(({ node }) => trace.nodes.has(node.id)).map(({ node }) => node.id),
    );
    const edges = new Set(
      laid.edges.filter(({ edge }) => trace.edges.has(edge.id)).map(({ edge }) => edge.id),
    );
    const lanesWithLitNode = new Set<string>();
    for (const { node } of laid.nodes) if (nodes.has(node.id)) lanesWithLitNode.add(node.lane);
    const lanes = new Set(
      laid.lanes
        .filter(({ lane }) => ids.has(lane.id) || lanesWithLitNode.has(lane.id))
        .map(({ lane }) => lane.id),
    );
    return { nodes, edges, lanes };
  }, [selected, highlight, laid]);

  const emphasised = useMemo(
    () => (lit === undefined || highlight === "neighbours" ? undefined : lit.edges),
    [lit, highlight],
  );

  const dimmedEdges = useMemo(
    () =>
      new Set(
        lit === undefined
          ? []
          : laid.edges.filter(({ edge }) => !lit.edges.has(edge.id)).map(({ edge }) => edge.id),
      ),
    [lit, laid],
  );

  return (
    <div
      role="figure"
      aria-label={doc.title}
      ref={viewportRef}
      className={cn("relative max-w-full overflow-auto", className)}
    >
      <div
        data-conduit-canvas
        className="relative rounded-xl bg-conduit-bg bg-[radial-gradient(var(--color-conduit-dot)_1px,transparent_1px)] bg-[size:18px_18px] text-conduit-fg"
        style={{
          width: laid.width,
          height: laid.height,
          ...(scale < 1
            ? {
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                marginRight: -(laid.width * (1 - scale)),
                marginBottom: -(laid.height * (1 - scale)),
              }
            : {}),
        }}
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
          emphasisedIds={emphasised}
          onEdgeClick={onEdgeClick}
        />

        {laid.nodes.map(({ node, box }) => {
          const headerHeight = headerHeightOf(node, heights);
          const hasBody = box.height > headerHeight;
          return (
            <Card
              key={node.id}
              id={node.id}
              node={node}
              box={box}
              headerHeight={headerHeight}
              dimmed={lit !== undefined && !lit.nodes.has(node.id)}
              selected={selected?.includes(node.id) ?? false}
              onClick={onNodeClick === undefined ? undefined : () => onNodeClick(node.id)}
            >
              {hasBody ? children?.(node) : null}
            </Card>
          );
        })}

        <ul className="sr-only">
          {laid.edges.map(({ edge }) => {
            const text = `${nodeLabel.get(edge.from) ?? edge.from} → ${nodeLabel.get(edge.to) ?? edge.to}, ${edge.kind}`;
            return (
              <li key={edge.id}>
                {onEdgeClick === undefined ? (
                  text
                ) : (
                  <button type="button" onClick={() => onEdgeClick(edge.id)}>
                    {text}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
