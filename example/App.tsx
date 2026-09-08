import { Diagram } from "@unpunnyfuns/lens";
import { useState } from "react";
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
  const [view, setView] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);

  const note = (entry: string) => setLog((previous) => [entry, ...previous].slice(0, 20));

  return (
    <div className={dark ? "dark" : undefined}>
      <div className="min-h-screen bg-lens-bg p-6 text-lens-fg">
        <header className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold">{ingress.title}</h1>
          <button
            type="button"
            className="rounded border border-lens-card-border px-2 py-1 text-sm"
            onClick={() => setDark((value) => !value)}
          >
            {dark ? "Light" : "Dark"}
          </button>
          <button
            type="button"
            className="rounded border border-lens-card-border px-2 py-1 text-sm"
            onClick={() => setFit((value) => !value)}
          >
            {fit ? "Unfit" : "Fit"}
          </button>
          <select
            className="rounded border border-lens-card-border bg-lens-card px-2 py-1 text-sm"
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
          {selected.length > 0 && (
            <button type="button" className="text-sm underline" onClick={() => setSelected([])}>
              Clear selection
            </button>
          )}
        </header>

        <div className="flex flex-wrap gap-6">
          <Diagram
            doc={ingress}
            view={view}
            selected={selected}
            fit={fit}
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

          <aside className="w-64 rounded-xl bg-lens-lane p-3 font-mono text-xs text-lens-muted">
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
