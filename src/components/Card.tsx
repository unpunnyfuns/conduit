import type { ReactNode } from "react";
import type { ConduitNode } from "../schema/document.js";
import type { Status } from "../schema/primitives.js";
import { cn } from "../cn.js";
import type { Box } from "../layout/geometry.js";
import { Badge } from "./Badge.js";
import { KindIcon } from "./icons.js";

const BORDER: Record<Status, string> = {
  neutral: "border-conduit-card-border",
  positive: "border-conduit-positive-border",
  caution: "border-conduit-caution-border",
  critical: "border-conduit-critical-border",
};

/** Below this width a card's title steps down a size, as upstream did. */
const SMALL_TITLE_BELOW = 200;

export type CardProps = {
  id?: string;
  node: ConduitNode;
  box: Box;
  /** Height of the title block the layout reserved; the body slot gets the rest. */
  headerHeight: number;
  dimmed?: boolean;
  selected?: boolean;
  onClick?: () => void;
  children?: ReactNode;
};

/**
 * One card. Absolutely positioned from its layout box so that a chart
 * mounting in the body changes nothing around it.
 */
export const Card = ({
  id,
  node,
  box,
  headerHeight,
  dimmed = false,
  selected = false,
  onClick,
  children,
}: CardProps) => {
  const hasBody = box.height > headerHeight;
  const label = node.subtitle === undefined ? node.label : `${node.label}, ${node.subtitle}`;
  const className = cn(
    "absolute flex flex-col rounded-[10px] border bg-conduit-card text-left shadow-[0_1px_2px_var(--color-conduit-shadow)] transition-opacity",
    BORDER[node.status],
    dimmed && "opacity-45",
    selected && "ring-2 ring-conduit-fg/40",
  );
  const style = { left: box.x, top: box.y, width: box.width, height: box.height };

  return (
    <div role="group" aria-label={label} data-conduit-node={id} className={className} style={style}>
      {onClick !== undefined && (
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className="absolute inset-x-0 top-0 cursor-pointer rounded-[10px] bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-conduit-fg/40"
          style={{ height: headerHeight }}
        />
      )}
      {node.badges.length > 0 && (
        <div className="absolute -top-2 right-[7px] flex gap-1.5">
          {node.badges.map((badge) => (
            <Badge key={badge.label} label={badge.label} tone={badge.tone} />
          ))}
        </div>
      )}
      <div
        className="flex shrink-0 items-center gap-[10px] px-[14px]"
        style={{ height: headerHeight }}
      >
        <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-conduit-chip">
          <KindIcon kind={node.kind} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span
            className={cn(
              "truncate font-semibold text-conduit-fg",
              box.width >= SMALL_TITLE_BELOW ? "text-[13px]" : "text-[11.5px]",
            )}
          >
            {node.label}
          </span>
          {node.subtitle !== undefined && (
            <span className="truncate font-mono text-[9.5px] text-conduit-muted">
              {node.subtitle}
            </span>
          )}
        </span>
      </div>
      {hasBody && <div className="min-h-0 flex-1 px-[14px] pb-[12px]">{children}</div>}
    </div>
  );
};
