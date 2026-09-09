import { useId } from "react";
import type { Status } from "../schema/primitives.js";
import { cn } from "../cn.js";
import {
  HERO_PULSE_COUNT,
  HERO_PULSE_DURATION,
  PILL_TEXT_SIZE,
  PULSE_DURATION,
} from "../layout/design.js";
import { coord } from "../layout/geometry.js";
import type { PlacedEdge } from "../layout/layout.js";
import { pulseDurationFor, type EdgeState } from "./pulse.js";
import { STATUSES } from "../schema/primitives.js";

const STROKE: Record<Status, string> = {
  neutral: "stroke-conduit-edge",
  positive: "stroke-conduit-positive",
  caution: "stroke-conduit-caution",
  critical: "stroke-conduit-critical",
};

const FILL: Record<Status, string> = {
  neutral: "fill-conduit-edge",
  positive: "fill-conduit-positive",
  caution: "fill-conduit-caution",
  critical: "fill-conduit-critical",
};

const PILL_TEXT: Record<Status, string> = {
  neutral: "fill-conduit-muted",
  positive: "fill-conduit-positive-text",
  caution: "fill-conduit-caution-text",
  critical: "fill-conduit-critical-text",
};

const PULSE_RADIUS = 2.6;
const TRAIN_RADIUS = 3;

/**
 * The travelling pulse: the mark that says a connection carries traffic
 * rather than merely existing. A dot running behind the drawing's clock says
 * so with a negative `begin`, so it is never seen waiting at the origin.
 */
const Pulses = ({
  id,
  path,
  tone,
  hero,
  duration,
}: {
  id: string;
  path: string;
  tone: Status;
  hero: boolean;
  duration: number;
}) => {
  const count = hero ? HERO_PULSE_COUNT : 1;
  return (
    <g data-pulse={id} className="motion-reduce:hidden">
      {Array.from({ length: count }, (_, index) => {
        const behind = ((duration / count) * index) % duration;
        return (
          <circle key={index} r={hero ? TRAIN_RADIUS : PULSE_RADIUS} className={FILL[tone]}>
            <animateMotion
              dur={`${coord(duration)}s`}
              begin={behind === 0 ? undefined : `${coord(behind - duration)}s`}
              repeatCount="indefinite"
              path={path}
            />
          </circle>
        );
      })}
    </g>
  );
};

const Pill = ({
  text,
  box,
  tone,
}: {
  text: string;
  box: { x: number; y: number; width: number; height: number };
  tone: Status;
}) => (
  <g>
    <rect
      className="fill-conduit-pill stroke-conduit-pill-border stroke-[1]"
      x={box.x}
      y={box.y}
      width={box.width}
      height={box.height}
      rx={box.height / 2}
    />
    <text
      className={cn("font-semibold", PILL_TEXT[tone])}
      style={{ fontSize: PILL_TEXT_SIZE }}
      x={box.x + box.width / 2}
      y={box.y + box.height / 2 + 3.5}
      textAnchor="middle"
    >
      {text}
    </text>
  </g>
);

const EMPTY: ReadonlySet<string> = new Set();
const NO_STATE: Readonly<Record<string, EdgeState>> = {};

export type EdgeLayerProps = {
  width: number;
  height: number;
  edges: readonly PlacedEdge[];
  dimmedIds: ReadonlySet<string>;
  /**
   * Edges drawn at hero weight without changing their pulses, e.g. a traced path.
   * An edge the document marks `muted` stays muted.
   */
  emphasisedIds?: ReadonlySet<string>;
  onEdgeClick?: (id: string) => void;
  /** Live overlay by edge id. Absent ids follow the document; see the mapping in the README. */
  edgeState?: Readonly<Record<string, EdgeState>>;
};

/**
 * Every edge of the diagram in one svg under the cards. Lines pass behind
 * cards; pills are opaque so they read wherever they land, and are drawn
 * last so they pass in front of everything in this layer.
 */
export const EdgeLayer = ({
  width,
  height,
  edges,
  dimmedIds,
  emphasisedIds = EMPTY,
  onEdgeClick,
  edgeState = NO_STATE,
}: EdgeLayerProps) => {
  const uid = useId().replace(/:/g, "");
  const marker = (tone: Status) => `${uid}-mk-${tone}`;

  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <defs>
        {STATUSES.map((tone) => (
          <marker
            key={tone}
            id={marker(tone)}
            viewBox="0 0 10 10"
            refX={8}
            refY={5}
            markerWidth={6.5}
            markerHeight={6.5}
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" className={FILL[tone]} />
          </marker>
        ))}
      </defs>

      {edges.map(({ edge, path, tone }) => {
        const state = edgeState[edge.id];
        const level = state?.level;
        const liveTone: Status =
          level === "down" ? "critical" : level === "stale" ? "caution" : tone;
        const pulsing = level === undefined ? edge.animated : level === "live";
        const heroPulses = edge.emphasis === "hero";
        const duration =
          level === "live"
            ? pulseDurationFor(state?.rate)
            : heroPulses
              ? HERO_PULSE_DURATION
              : PULSE_DURATION;
        const hero = heroPulses || (emphasisedIds.has(edge.id) && edge.emphasis !== "muted");
        const dimmed = dimmedIds.has(edge.id) || edge.emphasis === "muted";
        return (
          <g
            key={edge.id}
            data-edge-group={edge.id}
            className={cn("transition-opacity", dimmed && "opacity-45")}
          >
            {hero && (
              <path
                d={path}
                className={cn("fill-none stroke-[7] opacity-[0.14]", STROKE[liveTone])}
              />
            )}
            <path
              data-edge={edge.id}
              d={path}
              className={cn(
                "fill-none",
                STROKE[liveTone],
                hero ? "stroke-[2.25]" : "stroke-[1.5]",
                level === "down" && "[stroke-dasharray:5_4]",
              )}
              markerEnd={`url(#${marker(liveTone)})`}
            />
            {pulsing && (
              <Pulses
                id={edge.id}
                path={path}
                tone={liveTone}
                hero={heroPulses}
                duration={duration}
              />
            )}
            {onEdgeClick !== undefined && (
              <path
                data-edge-hit={edge.id}
                d={path}
                className="pointer-events-auto cursor-pointer fill-none stroke-transparent stroke-[12]"
                onClick={() => onEdgeClick(edge.id)}
              />
            )}
          </g>
        );
      })}

      {edges.map(({ edge, label, tone }) => {
        if (label === undefined) return null;
        const level = edgeState[edge.id]?.level;
        const liveTone: Status =
          level === "down" ? "critical" : level === "stale" ? "caution" : tone;
        return <Pill key={`${edge.id}-label`} text={label.text} box={label.box} tone={liveTone} />;
      })}
    </svg>
  );
};
