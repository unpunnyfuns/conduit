import type { ReactNode } from "react";
import type { ConduitNode, Edge } from "../../schema/document.js";
import { Badge } from "../Badge.js";
import { KindIcon } from "../icons.js";

export type NodeDetailProps = {
  node: ConduitNode;
  edges: readonly Edge[];
  labelOf: (id: string) => string;
  titleId: string;
  onSelect?: (id: string) => void;
  children?: ReactNode;
};

const Connections = ({
  heading,
  entries,
  onSelect,
}: {
  heading: string;
  entries: readonly { edgeId: string; id: string; label: string; via: string }[];
  onSelect?: (id: string) => void;
}) =>
  entries.length === 0 ? null : (
    <div className="mt-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-conduit-muted">
        {heading}
      </div>
      <ul className="mt-1 flex flex-col gap-0.5">
        {entries.map((entry) => (
          <li key={entry.edgeId} className="flex items-baseline justify-between gap-2 text-[12px]">
            {onSelect === undefined ? (
              <span>{entry.label}</span>
            ) : (
              <button
                type="button"
                className="text-left underline-offset-2 hover:underline"
                onClick={() => onSelect(entry.id)}
              >
                {entry.label}
              </button>
            )}
            <span className="font-mono text-[10px] text-conduit-muted">{entry.via}</span>
          </li>
        ))}
      </ul>
    </div>
  );

const via = (edge: Edge) => edge.label ?? edge.kind;

/** The document's view of one node: what it is, what it says, and who it talks to. */
export const NodeDetail = ({
  node,
  edges,
  labelOf,
  titleId,
  onSelect,
  children,
}: NodeDetailProps) => {
  const incoming = edges
    .filter((edge) => edge.to === node.id && edge.from !== node.id)
    .map((edge) => ({ edgeId: edge.id, id: edge.from, label: labelOf(edge.from), via: via(edge) }));
  const outgoing = edges
    .filter((edge) => edge.from === node.id && edge.to !== node.id)
    .map((edge) => ({ edgeId: edge.id, id: edge.to, label: labelOf(edge.to), via: via(edge) }));

  return (
    <div>
      <div className="flex items-center gap-[10px]">
        <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-conduit-chip">
          <KindIcon kind={node.kind} />
        </span>
        <div className="min-w-0">
          <h3 id={titleId} className="truncate text-[13px] font-semibold">
            {node.label}
          </h3>
          {node.subtitle !== undefined && (
            <div className="truncate font-mono text-[9.5px] text-conduit-muted">
              {node.subtitle}
            </div>
          )}
        </div>
      </div>
      {node.badges.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {node.badges.map((badge, index) => (
            <Badge key={`${badge.label}-${index}`} label={badge.label} tone={badge.tone} />
          ))}
        </div>
      )}
      {node.summary !== undefined && (
        <p className="mt-2 text-[12px] leading-snug">{node.summary}</p>
      )}
      <Connections heading="Receives from" entries={incoming} onSelect={onSelect} />
      <Connections heading="Sends to" entries={outgoing} onSelect={onSelect} />
      {children}
    </div>
  );
};
