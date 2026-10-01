# highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Selecting a card can light the whole upstream (or downstream) path, with the path's edges emphasised, via a `highlight` prop on `Diagram` and a pure `traceFrom` helper.

**Architecture:** A framework-free `traceFrom(edges, seeds, highlight)` in `src/layout/trace.ts` computes lit node/edge sets by walking the edge list. `Diagram` replaces its inline neighbour logic with a call to it and forwards lit edges to `EdgeLayer` as `emphasisedIds` when the mode traces. No engine or schema change.

**Tech Stack:** unchanged.

**Spec:** `docs/superpowers/specs/2026-09-08-highlight-design.md`

## Global Constraints

- `.js` import extensions; functional style, no classes; no inline end-of-line comments; deterministic (iterate `edges` in array order).
- `highlight` default `"neighbours"` must reproduce today's `Diagram` dimming exactly — the existing browser test "dims everything not selected or adjacent" stays green unchanged.
- Emphasis by selection changes stroke weight and glow only, never pulse count/timing.
- Full check before each commit: `npm run lint && npm run format && npm run typecheck && npm test`. Git author is configured — plain `git commit`.

## File Structure

```
src/layout/trace.ts            NEW: Highlight, Trace, traceFrom
src/layout.ts                  + export traceFrom, types
src/components/EdgeLayer.tsx   + emphasisedIds prop
src/components/Diagram.tsx     + highlight prop; lit via traceFrom
example/App.tsx                + highlight select
README.md, CLAUDE.md           docs
test/layout/trace.test.ts      NEW
test/browser/diagram.test.tsx  + upstream test
```

---

### Task 1: `traceFrom`

**Files:** Create `src/layout/trace.ts`; modify `src/layout.ts`; test `test/layout/trace.test.ts`.

**Interfaces:** Produces `Highlight`, `Trace`, `traceFrom(edges: readonly Edge[], seeds: readonly string[], highlight: Highlight): Trace` (from `src/layout/trace.js`, re-exported by `src/layout.ts` and therefore `src/index.ts` via `export * from "./layout.js"`).

- [ ] **Step 1: Failing tests** — `test/layout/trace.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ingress } from "../../example/data/ingress.js";
import type { Edge } from "../../src/index.js";
import { traceFrom } from "../../src/layout/trace.js";

const sorted = (set: Set<string>) => [...set].sort();

const edge = (id: string, from: string, to: string): Edge => ({
  id,
  from,
  to,
  kind: "call",
  emphasis: "normal",
  animated: false,
  status: "neutral",
});

describe("traceFrom on the ingress document", () => {
  it("upstream of warehouse reaches every source and nothing downstream", () => {
    const trace = traceFrom(ingress.edges, ["warehouse"], "upstream");
    expect(sorted(trace.nodes)).toEqual(
      ["batch-loader", "kafka-ingest", "partner-api", "pii-scrubber", "raw-lake", "schema-validator", "sftp-drop", "warehouse", "webhooks"].sort(),
    );
    expect(sorted(trace.edges)).toEqual(
      ["batch-to-validator", "kafka-to-validator", "lake-to-warehouse", "partner-to-kafka", "scrubber-to-lake", "sftp-to-batch", "validator-to-scrubber", "webhooks-to-kafka"].sort(),
    );
    expect(trace.nodes.has("analytics-ui")).toBe(false);
    expect(trace.nodes.has("legacy-ftp")).toBe(false);
    expect(trace.edges.has("warehouse-to-ui")).toBe(false);
    expect(trace.edges.has("batch-to-legacy")).toBe(false);
  });

  it("downstream of kafka-ingest reaches the consumers", () => {
    const trace = traceFrom(ingress.edges, ["kafka-ingest"], "downstream");
    expect(sorted(trace.nodes)).toEqual(
      ["analytics-ui", "kafka-ingest", "pii-scrubber", "raw-lake", "reporting-job", "schema-validator", "warehouse"].sort(),
    );
    expect(trace.nodes.has("partner-api")).toBe(false);
  });

  it("both is the union", () => {
    const both = traceFrom(ingress.edges, ["schema-validator"], "both");
    const up = traceFrom(ingress.edges, ["schema-validator"], "upstream");
    const down = traceFrom(ingress.edges, ["schema-validator"], "downstream");
    expect(sorted(both.nodes)).toEqual(sorted(new Set([...up.nodes, ...down.nodes])));
    expect(sorted(both.edges)).toEqual(sorted(new Set([...up.edges, ...down.edges])));
  });

  it("neighbours lights the seed and its touching edges only", () => {
    const trace = traceFrom(ingress.edges, ["schema-validator"], "neighbours");
    expect(sorted(trace.nodes)).toEqual(["schema-validator"]);
    expect(sorted(trace.edges)).toEqual(["batch-to-validator", "kafka-to-validator", "validator-to-scrubber"].sort());
  });

  it("a seeded edge id lights only that edge in every mode", () => {
    for (const mode of ["neighbours", "upstream", "downstream", "both"] as const) {
      const trace = traceFrom(ingress.edges, ["lake-to-warehouse"], mode);
      expect(sorted(trace.edges), mode).toEqual(["lake-to-warehouse"]);
      expect(trace.nodes.size, mode).toBe(0);
    }
  });

  it("ignores unknown ids", () => {
    const trace = traceFrom(ingress.edges, ["nope"], "upstream");
    expect(trace.nodes.size).toBe(0);
    expect(trace.edges.size).toBe(0);
  });
});

describe("traceFrom on synthetic graphs", () => {
  it("terminates on a cycle and lights both sides", () => {
    const edges = [edge("ab", "a", "b"), edge("ba", "b", "a")];
    const trace = traceFrom(edges, ["a"], "upstream");
    expect(sorted(trace.nodes)).toEqual(["a", "b"]);
    expect(sorted(trace.edges)).toEqual(["ab", "ba"]);
  });

  it("does not follow a self-loop when tracing, but lights it as a neighbour", () => {
    const edges = [edge("aa", "a", "a"), edge("ba", "b", "a")];
    const up = traceFrom(edges, ["a"], "upstream");
    expect(sorted(up.edges)).toEqual(["ba"]);
    const near = traceFrom(edges, ["a"], "neighbours");
    expect(sorted(near.edges)).toEqual(["aa", "ba"]);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/layout/trace.test.ts` — FAIL, module not found.

- [ ] **Step 3: Write `src/layout/trace.ts`**

```ts
import type { Edge } from "../schema/document.js";
import { assertNever } from "../assert.js";

/** What a selection lights: its neighbours, everything feeding it, everything it feeds, or both. */
export type Highlight = "neighbours" | "upstream" | "downstream" | "both";

export type Trace = { nodes: Set<string>; edges: Set<string> };

/**
 * Breadth-first over the edge list from every seed, in the given direction.
 * Edges are scanned in array order on every step so the walk — and the
 * insertion order of the sets it fills — is the same for the same document.
 */
const walk = (
  edges: readonly Edge[],
  seeds: ReadonlySet<string>,
  forward: boolean,
  into: Trace,
): void => {
  const queue = [...seeds];
  const visited = new Set(seeds);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const edge of edges) {
      if (edge.from === edge.to) continue;
      const [here, next] = forward ? [edge.from, edge.to] : [edge.to, edge.from];
      if (here !== current) continue;
      into.edges.add(edge.id);
      into.nodes.add(next);
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
};

/**
 * The nodes and edges a selection lights.
 *
 * Seeds may be node ids or edge ids. A seeded edge is lit but never starts a
 * walk; a seeded node is lit and, for the tracing modes, starts one. Ids that
 * match nothing are ignored.
 */
export const traceFrom = (
  edges: readonly Edge[],
  seeds: readonly string[],
  highlight: Highlight,
): Trace => {
  const edgeIds = new Set(edges.map((edge) => edge.id));
  const nodeIds = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
  const seedNodes = new Set(seeds.filter((id) => nodeIds.has(id)));
  const trace: Trace = {
    nodes: new Set(seedNodes),
    edges: new Set(seeds.filter((id) => edgeIds.has(id))),
  };

  switch (highlight) {
    case "neighbours":
      for (const edge of edges)
        if (seedNodes.has(edge.from) || seedNodes.has(edge.to)) trace.edges.add(edge.id);
      return trace;
    case "upstream":
      walk(edges, seedNodes, false, trace);
      return trace;
    case "downstream":
      walk(edges, seedNodes, true, trace);
      return trace;
    case "both":
      walk(edges, seedNodes, false, trace);
      walk(edges, seedNodes, true, trace);
      return trace;
    default:
      return assertNever(highlight, "Unhandled highlight");
  }
};
```

Note: `nodeIds` is derived from edges, so a seeded node with no edges at all is not in `nodeIds` and would be dropped. That is wrong for an isolated card — it must still count as lit. Fix inside `traceFrom`: seed nodes are `seeds.filter((id) => !edgeIds.has(id))` (anything that is not an edge id is treated as a node id; unknown ids are harmless because `Diagram` intersects with the layout's nodes). Update the "ignores unknown ids" test to expect `trace.nodes` to contain `"nope"` (size 1) and `trace.edges` size 0 — the intersection happens in `Diagram`. Apply this before running the tests.

- [ ] **Step 4: Export** — in `src/layout.ts` add `export { traceFrom, type Highlight, type Trace } from "./layout/trace.js";`.

- [ ] **Step 5: Run** the full check. Commit: `git add -A && git commit -m "Add traceFrom for upstream/downstream selection tracing"`.

---

### Task 2: `highlight` on `Diagram`, `emphasisedIds` on `EdgeLayer`

**Files:** Modify `src/components/EdgeLayer.tsx`, `src/components/Diagram.tsx`; test `test/browser/diagram.test.tsx`.

**Interfaces:** `EdgeLayerProps.emphasisedIds?: ReadonlySet<string>`; `DiagramProps.highlight?: Highlight` (default `"neighbours"`).

- [ ] **Step 1: Failing browser test** — append inside `describe("Diagram")`:

```tsx
  it("lights the whole upstream path and emphasises its edges", async () => {
    const screen = await render(<Diagram doc={ingress} selected={["warehouse"]} highlight="upstream" />);
    const opacity = (selector: string) =>
      Number(getComputedStyle(screen.container.querySelector(selector) as Element).opacity);
    expect(opacity("[data-conduit-node='partner-api']")).toBe(1);
    expect(opacity("[data-conduit-node='raw-lake']")).toBe(1);
    expect(opacity("[data-conduit-node='analytics-ui']")).toBeLessThan(1);
    expect(opacity("g[data-edge-group='partner-to-kafka']")).toBe(1);
    expect(opacity("g[data-edge-group='warehouse-to-ui']")).toBeLessThan(1);
    const traced = screen.container.querySelector("path[data-edge='partner-to-kafka']") as SVGPathElement;
    const untraced = screen.container.querySelector("path[data-edge='warehouse-to-ui']") as SVGPathElement;
    expect(parseFloat(getComputedStyle(traced).strokeWidth)).toBeCloseTo(2.25, 1);
    expect(parseFloat(getComputedStyle(untraced).strokeWidth)).toBeCloseTo(1.5, 1);
  });

  it("keeps pulse count unchanged when a traced edge is emphasised", async () => {
    const screen = await render(<Diagram doc={ingress} selected={["warehouse"]} highlight="upstream" />);
    expect(screen.container.querySelectorAll("[data-pulse='partner-to-kafka'] animateMotion").length).toBe(1);
  });
```

- [ ] **Step 2: Run** `npm run test:browser -- diagram` — the two new tests fail (`highlight` unknown; `partner-api` dimmed).

- [ ] **Step 3: `EdgeLayer.tsx`.** Add `emphasisedIds?: ReadonlySet<string>;` to `EdgeLayerProps` with doc comment `/** Edges drawn at hero weight without changing their pulses, e.g. a traced path. */`. Destructure with default `emphasisedIds = EMPTY` where `const EMPTY: ReadonlySet<string> = new Set();` at module scope. In the edge map replace `const hero = edge.emphasis === "hero";` with:

```tsx
        const heroPulses = edge.emphasis === "hero";
        const hero = heroPulses || emphasisedIds.has(edge.id);
```

Keep `hero` for the glow path and stroke width; change the `Pulses` call to `hero={heroPulses}`.

- [ ] **Step 4: `Diagram.tsx`.** Import `traceFrom, type Highlight` from `../layout/trace.js`. Add prop `highlight?: Highlight;` (doc: `/** What a selection lights: neighbours (default), everything upstream, downstream, or both. */`) and destructure `highlight = "neighbours"`. Replace the `lit` memo body with:

```tsx
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
```

and pass `emphasisedIds={emphasised}` to `EdgeLayer`. Sanity: with `"neighbours"`, `trace.nodes` = seeded node ids and `trace.edges` = seeded edge ids ∪ touching edges — identical to the old inline logic.

- [ ] **Step 5: Run** the full check — the existing "dims everything not selected or adjacent" test must still pass unchanged. Commit: `git add -A && git commit -m "Add highlight modes to Diagram"`.

---

### Task 3: Example and docs

**Files:** Modify `example/App.tsx`, `README.md`, `CLAUDE.md`; test `test/browser/example.test.tsx`.

- [ ] **Step 1: Example.** In `example/App.tsx`: `const [highlight, setHighlight] = useState<Highlight>("upstream");` (import `type Highlight` from `@unpunnyfuns/conduit`), a header `<select>` after the view select:

```tsx
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
```

and `highlight={highlight}` on `Diagram`.

- [ ] **Step 2: Example test** — append to `test/browser/example.test.tsx`:

```tsx
  it("traces upstream by default when a card is selected", async () => {
    const screen = await render(<App />);
    await screen.getByRole("button", { name: "Warehouse", exact: true }).click();
    const opacity = (selector: string) =>
      Number(getComputedStyle(screen.container.querySelector(selector) as Element).opacity);
    expect(opacity("[data-conduit-node='partner-api']")).toBe(1);
    expect(opacity("[data-conduit-node='analytics-ui']")).toBeLessThan(1);
  });
```

- [ ] **Step 3: Docs.** README `Diagram` props table: add `| \`highlight\` | \`"neighbours" \| "upstream" \| "downstream" \| "both"\` | what a selection lights; traced edges draw at hero weight |`. Under "Layout without React" add:

```ts
import { traceFrom } from "@unpunnyfuns/conduit/layout";

const { nodes, edges } = traceFrom(doc.edges, ["warehouse"], "upstream");
```

CLAUDE.md, Architecture item 3: append the sentence "`highlight` decides what a selection lights, via the pure `traceFrom` in `src/layout/trace.ts`; traced edges are emphasised through `EdgeLayer`'s `emphasisedIds`, never by mutating the document."

- [ ] **Step 4: Run** the full check and `npx vite build -c example/vite.config.ts`. Commit: `git add -A && git commit -m "Default the example to upstream highlighting and document it"`.

## Self-review notes

- Spec → tasks: helper + rules → T1; `Diagram`/`EdgeLayer` → T2; example/README → T3; every listed test present.
- The isolated-node correction in T1 Step 3 supersedes the "ignores unknown ids" expectation in T1 Step 1 — the implementer applies both before running.
- Names: `traceFrom`, `Highlight`, `Trace`, `emphasisedIds`, `highlight` used consistently across tasks.
