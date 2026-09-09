import { Diagram, type EdgeState, type Highlight } from "@unpunnyfuns/conduit";
import { useEffect, useMemo, useState } from "react";
import { ingress } from "./data/ingress.js";
import { Sparkline } from "./Sparkline.js";

const UNITS: Record<string, string> = {
  "kafka-ingest": "msg/s",
  "batch-loader": "rows/s",
  "schema-validator": "ok/s",
  "raw-lake": "MB/s",
  warehouse: "q/min",
};

export const App = () => {
  const [dark, setDark] = useState(false);
  const [fit, setFit] = useState(false);
  const [direction, setDirection] = useState<"right" | "down">("right");
  const [highlight, setHighlight] = useState<Highlight>("upstream");
  const [view, setView] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [outage, setOutage] = useState(false);
  const [rate, setRate] = useState(50);

  const note = (entry: string) => setLog((previous) => [entry, ...previous].slice(0, 20));
  const doc = useMemo(() => ({ ...ingress, direction }), [direction]);

  useEffect(() => {
    if (!outage) return;
    const rates = [50, 200, 800, 2000] as const;
    let index = 0;
    const timer = setInterval(() => {
      index = (index + 1) % rates.length;
      setRate(rates[index] ?? rates[0]);
    }, 1000);
    return () => clearInterval(timer);
  }, [outage]);

  const edgeState = useMemo<Record<string, EdgeState> | undefined>(
    () =>
      outage
        ? {
            "batch-to-validator": { level: "down" },
            "sftp-to-batch": { level: "stale" },
            "partner-to-kafka": { level: "live", rate },
            "webhooks-to-kafka": { level: "idle" },
          }
        : undefined,
    [outage, rate],
  );

  return (
    <div className={dark ? "dark" : undefined}>
      <div className="min-h-screen bg-conduit-bg p-6 text-conduit-fg">
        <header className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold">{ingress.title}</h1>
          <button
            type="button"
            className="rounded border border-conduit-card-border px-2 py-1 text-sm"
            onClick={() => setDark((value) => !value)}
          >
            {dark ? "Light" : "Dark"}
          </button>
          <button
            type="button"
            className="rounded border border-conduit-card-border px-2 py-1 text-sm"
            onClick={() => setFit((value) => !value)}
          >
            {fit ? "Unfit" : "Fit"}
          </button>
          <button
            type="button"
            className="rounded border border-conduit-card-border px-2 py-1 text-sm"
            onClick={() => setDirection((value) => (value === "right" ? "down" : "right"))}
          >
            {direction === "right" ? "Down" : "Right"}
          </button>
          <select
            className="rounded border border-conduit-card-border bg-conduit-card px-2 py-1 text-sm"
            value={view ?? ""}
            onChange={(event) =>
              setView(event.target.value === "" ? undefined : event.target.value)
            }
          >
            <option value="">Whole document</option>
            {ingress.views.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-conduit-card-border bg-conduit-card px-2 py-1 text-sm"
            value={highlight}
            onChange={(event) => setHighlight(event.target.value as Highlight)}
            aria-label="Highlight"
          >
            <option value="neighbours">Neighbours</option>
            <option value="upstream">Upstream</option>
            <option value="downstream">Downstream</option>
            <option value="both">Both</option>
          </select>
          <button
            type="button"
            className="rounded border border-conduit-card-border px-2 py-1 text-sm"
            onClick={() => setOutage((value) => !value)}
          >
            {outage ? "Recover" : "Simulate outage"}
          </button>
          {selected.length > 0 && (
            <button type="button" className="text-sm underline" onClick={() => setSelected([])}>
              Clear selection
            </button>
          )}
        </header>

        <div className="flex flex-wrap gap-6">
          <Diagram
            doc={doc}
            view={view}
            selected={selected}
            highlight={highlight}
            fit={fit}
            edgeState={edgeState}
            className="max-h-[70vh]"
            onNodeClick={(id) => {
              setSelected((previous) => (previous.includes(id) ? [] : [id]));
              note(`node ${id}`);
            }}
            onEdgeClick={(id) => note(`edge ${id}`)}
          >
            {(node) =>
              node.size === "chart" ? (
                <Sparkline source={node.id} unit={UNITS[node.id] ?? ""} />
              ) : null
            }
          </Diagram>

          <aside className="w-64 rounded-xl bg-conduit-lane p-3 font-mono text-xs text-conduit-muted">
            <div className="mb-2 font-bold uppercase tracking-[0.12em]">Events</div>
            {log.length === 0 ? (
              <div>Click a card or an edge.</div>
            ) : (
              log.map((entry, index) => <div key={`${index}-${entry}`}>{entry}</div>)
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};
