import type { ReactNode } from "react";
import type { Edge } from "../../schema/document.js";
import type { EdgeState } from "../pulse.js";

export type EdgeDetailProps = {
  edge: Edge;
  fromLabel: string;
  toLabel: string;
  titleId: string;
  state?: EdgeState;
  children?: ReactNode;
};

/** One connection: its ends, what it carries, and how it is doing right now. */
export const EdgeDetail = ({
  edge,
  fromLabel,
  toLabel,
  titleId,
  state,
  children,
}: EdgeDetailProps) => (
  <div>
    <h3 id={titleId} className="text-[13px] font-semibold">{`${fromLabel} → ${toLabel}`}</h3>
    <div className="mt-1 font-mono text-[10px] text-conduit-muted">
      {edge.kind}
      {edge.label !== undefined && ` · ${edge.label}`}
    </div>
    {edge.summary !== undefined && <p className="mt-2 text-[12px] leading-snug">{edge.summary}</p>}
    {state !== undefined && (
      <div className="mt-2 text-[12px]">
        {`State: ${state.level}`}
        {state.rate !== undefined && ` · ${state.rate}/s`}
      </div>
    )}
    {children}
  </div>
);
