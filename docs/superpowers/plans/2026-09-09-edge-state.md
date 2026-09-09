# edgeState Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An `edgeState` overlay prop so an app can mark any edge live/idle/stale/down (with an optional rate driving pulse speed) without touching the document or relayouting.

**Architecture:** A pure `src/components/pulse.ts` holds the types and `pulseDurationFor`. `EdgeLayer` reads `edgeState[edge.id]` to decide pulses, tone and dash; `Diagram` forwards the prop. Layout code untouched.

**Spec:** `docs/superpowers/specs/2026-09-09-edge-state-design.md`

## Global Constraints

- `.js` imports; no classes; no inline end-of-line comments; Tailwind utilities against `conduit-*` tokens.
- Absent state must reproduce today's rendering exactly (all existing browser tests unchanged and green).
- Changing `edgeState` must not call `layout()` — it is not in the layout memo's deps.
- Full check before each commit: `npm run lint && npm run format && npm run typecheck && npm test`. Git author configured — plain `git commit`.

## File Structure

```
src/layout/design.ts          + PULSE_RATE_SCALE, PULSE_DURATION_MIN, PULSE_DURATION_MAX
src/components/pulse.ts       NEW: EdgeLevel, EdgeState, EDGE_LEVELS, pulseDurationFor
src/components/EdgeLayer.tsx  + edgeState prop; mapping
src/components/Diagram.tsx    + edgeState prop (forwarded)
src/index.ts                  + exports
example/App.tsx               + Simulate outage toggle
README.md, CLAUDE.md          docs
test/layout/pulse.test.ts     NEW
test/browser/diagram.test.tsx + edgeState tests
test/browser/example.test.tsx + outage toggle test
```

---

### Task 1: `pulse.ts`, `EdgeLayer`/`Diagram` prop, tests

**Files:** create `src/components/pulse.ts`, `test/layout/pulse.test.ts`; modify `src/layout/design.ts`, `src/components/EdgeLayer.tsx`, `src/components/Diagram.tsx`, `src/index.ts`, `test/browser/diagram.test.tsx`.

**Interfaces produced:** `EdgeLevel`, `EdgeState`, `EDGE_LEVELS`, `pulseDurationFor(rate?: number): number` from `src/components/pulse.js` (re-exported by `src/index.ts`); `EdgeLayerProps.edgeState?` and `DiagramProps.edgeState?: Readonly<Record<string, EdgeState>>`.

- [ ] **Step 1: Node test** — `test/layout/pulse.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EDGE_LEVELS, pulseDurationFor } from "../../src/components/pulse.js";
import { PULSE_DURATION } from "../../src/layout/design.js";

describe("pulseDurationFor", () => {
  it("falls back to the default without a rate", () => {
    expect(pulseDurationFor(undefined)).toBe(PULSE_DURATION);
    expect(pulseDurationFor(0)).toBe(PULSE_DURATION);
    expect(pulseDurationFor(-5)).toBe(PULSE_DURATION);
  });

  it("maps a rate to a clamped period", () => {
    expect(pulseDurationFor(100)).toBe(1.6);
    expect(pulseDurationFor(1000)).toBe(0.6);
    expect(pulseDurationFor(10)).toBe(3);
    expect(pulseDurationFor(200)).toBe(0.8);
  });
});

describe("EDGE_LEVELS", () => {
  it("lists the four levels in order", () => {
    expect(EDGE_LEVELS).toEqual(["live", "idle", "stale", "down"]);
  });
});
```

- [ ] **Step 2: Browser tests** — append inside `describe("Diagram")` in `test/browser/diagram.test.tsx` (the file already imports `render`, `Diagram`, `ingress`, `layout`):

```tsx
  it("marks a down edge critical, dashed and unpulsed", async () => {
    const screen = await render(
      <Diagram doc={ingress} edgeState={{ "batch-to-validator": { level: "down" } }} />,
    );
    const path = screen.container.querySelector("path[data-edge='batch-to-validator']") as SVGPathElement;
    expect(getComputedStyle(path).stroke).toBe("rgb(207, 34, 46)");
    expect(getComputedStyle(path).strokeDasharray).not.toBe("none");
    expect(screen.container.querySelectorAll("[data-pulse='batch-to-validator'] animateMotion").length).toBe(0);
  });

  it("colours a down edge's pill with the critical text tone", async () => {
    const screen = await render(
      <Diagram doc={ingress} edgeState={{ "lake-to-warehouse": { level: "down" } }} />,
    );
    const pill = screen.getByText("dbt").element();
    expect(getComputedStyle(pill).fill).toBe("rgb(164, 14, 38)");
  });

  it("pulses a live edge at a rate-derived period even when the document is static", async () => {
    const screen = await render(
      <Diagram doc={ingress} edgeState={{ "sftp-to-batch": { level: "live", rate: 1000 } }} />,
    );
    const motions = screen.container.querySelectorAll("[data-pulse='sftp-to-batch'] animateMotion");
    expect(motions.length).toBe(1);
    expect(motions[0]?.getAttribute("dur")).toBe("0.6s");
  });

  it("silences an animated edge marked idle", async () => {
    const screen = await render(
      <Diagram doc={ingress} edgeState={{ "partner-to-kafka": { level: "idle" } }} />,
    );
    expect(screen.container.querySelectorAll("[data-pulse='partner-to-kafka'] animateMotion").length).toBe(0);
  });

  it("turns a stale hero edge caution and stops its train", async () => {
    const screen = await render(
      <Diagram doc={ingress} edgeState={{ "kafka-to-validator": { level: "stale" } }} />,
    );
    const path = screen.container.querySelector("path[data-edge='kafka-to-validator']") as SVGPathElement;
    expect(getComputedStyle(path).stroke).toBe("rgb(191, 135, 0)");
    expect(screen.container.querySelectorAll("[data-pulse='kafka-to-validator'] animateMotion").length).toBe(0);
  });

  it("does not relayout when edge state changes", async () => {
    const screen = await render(
      <Diagram doc={ingress} edgeState={{ "partner-to-kafka": { level: "live", rate: 50 } }} />,
    );
    const card = () => (screen.container.querySelector("[data-conduit-node='warehouse']") as HTMLElement).getBoundingClientRect();
    const canvas = () => (screen.container.querySelector("[data-conduit-canvas]") as HTMLElement).getBoundingClientRect().width;
    const before = { card: card(), canvas: canvas() };
    await screen.rerender(
      <Diagram doc={ingress} edgeState={{ "partner-to-kafka": { level: "down" }, "lake-to-warehouse": { level: "stale" } }} />,
    );
    expect(card()).toEqual(before.card);
    expect(canvas()).toBe(before.canvas);
  });
```

(`rerender` is on the object `render()` resolves to in `vitest-browser-react`; if it's named differently in the installed version, use what the type says and note it.)

- [ ] **Step 3: Run** `npx vitest run test/layout/pulse.test.ts` and `npm run test:browser -- diagram` — new tests fail.

- [ ] **Step 4: Constants** — `src/layout/design.ts`, after `HERO_PULSE_COUNT`:

```ts
/** Live edges: seconds per pulse ≈ PULSE_RATE_SCALE / rate, clamped so 10/s and 10k/s both read as traffic. */
export const PULSE_RATE_SCALE = 160;
export const PULSE_DURATION_MIN = 0.6;
export const PULSE_DURATION_MAX = 3;
```

- [ ] **Step 5: `src/components/pulse.ts`**

```ts
import {
  PULSE_DURATION,
  PULSE_DURATION_MAX,
  PULSE_DURATION_MIN,
  PULSE_RATE_SCALE,
} from "../layout/design.js";

/** What a hop is doing right now, as the app sees it. Absent means "whatever the document says". */
export type EdgeLevel = "live" | "idle" | "stale" | "down";

export const EDGE_LEVELS: readonly EdgeLevel[] = ["live", "idle", "stale", "down"];

export type EdgeState = {
  level: EdgeLevel;
  /** Messages per second, or any unit; only its magnitude sets the pulse period. */
  rate?: number;
};

/** Seconds per pulse cycle for a rate, clamped so extremes stay legible. */
export const pulseDurationFor = (rate?: number): number => {
  if (rate === undefined || rate <= 0) return PULSE_DURATION;
  const raw = PULSE_RATE_SCALE / rate;
  return Math.round(Math.min(PULSE_DURATION_MAX, Math.max(PULSE_DURATION_MIN, raw)) * 100) / 100;
};
```

- [ ] **Step 6: `EdgeLayer.tsx`.** Import `type EdgeState`, `pulseDurationFor` from `./pulse.js`. Add to `EdgeLayerProps`:

```ts
  /** Live overlay by edge id. Absent ids follow the document; see the mapping in the README. */
  edgeState?: Readonly<Record<string, EdgeState>>;
```

with `const NO_STATE: Readonly<Record<string, EdgeState>> = {};` at module scope and `edgeState = NO_STATE` in the destructure. `Pulses` gains a `duration: number` prop replacing its internal `duration` derivation (`count` still from `hero`). In the edge map, replace the three `const` lines and the JSX that reads `tone`/`edge.animated` with:

```tsx
        const state = edgeState[edge.id];
        const level = state?.level;
        const liveTone: Status =
          level === "down" ? "critical" : level === "stale" ? "caution" : tone;
        const pulsing = level === undefined ? edge.animated : level === "live";
        const heroPulses = edge.emphasis === "hero";
        const duration =
          level === "live" ? pulseDurationFor(state?.rate) : heroPulses ? HERO_PULSE_DURATION : PULSE_DURATION;
        const hero = heroPulses || (emphasisedIds.has(edge.id) && edge.emphasis !== "muted");
        const dimmed = dimmedIds.has(edge.id) || edge.emphasis === "muted";
```

Use `liveTone` (not `tone`) for `STROKE[...]` on glow and main path, for `markerEnd`, and pass `tone={liveTone}` to `Pulses`. Add `level === "down" && "[stroke-dasharray:5_4]"` to the main path's `cn(...)`. Render `{pulsing && <Pulses id={edge.id} path={path} tone={liveTone} hero={heroPulses} duration={duration} />}`. In the pills map, compute the same `liveTone` from `edgeState[edge.id]?.level` and pass it.

- [ ] **Step 7: `Diagram.tsx`.** Add `edgeState?: Readonly<Record<string, EdgeState>>;` to `DiagramProps` (doc: `/** Live overlay by edge id; changes never relayout. */`), destructure it, pass `edgeState={edgeState}` to `EdgeLayer`. Do not add it to any memo deps.

- [ ] **Step 8: `src/index.ts`** — `export { EDGE_LEVELS, pulseDurationFor, type EdgeLevel, type EdgeState } from "./components/pulse.js";`

- [ ] **Step 9: Run** the full check; every pre-existing browser test must pass unchanged. Commit: `git add -A && git commit -m "Add edgeState live overlay to EdgeLayer and Diagram"`.

---

### Task 2: Example and docs

**Files:** modify `example/App.tsx`, `README.md`, `CLAUDE.md`; test `test/browser/example.test.tsx`.

- [ ] **Step 1: Example.** In `example/App.tsx`: `const [outage, setOutage] = useState(false); const [rate, setRate] = useState(50);` plus an effect that, while `outage` is on, cycles `rate` through `[50, 200, 800, 2000]` every second (clear the interval on cleanup / when off). Build `const edgeState = useMemo<Record<string, EdgeState> | undefined>(() => outage ? { "batch-to-validator": { level: "down" }, "sftp-to-batch": { level: "stale" }, "partner-to-kafka": { level: "live", rate }, "webhooks-to-kafka": { level: "idle" } } : undefined, [outage, rate]);` (import `type EdgeState` from `@unpunnyfuns/conduit`). Header button after the highlight select: label `Simulate outage` / `Recover`. Pass `edgeState={edgeState}` to `Diagram`.

- [ ] **Step 2: Example test** — append to `test/browser/example.test.tsx`:

```tsx
  it("simulates an outage and recovers", async () => {
    const screen = await render(<App />);
    await screen.getByRole("button", { name: "Simulate outage" }).click();
    const path = () => screen.container.querySelector("path[data-edge='batch-to-validator']") as SVGPathElement;
    await expect.poll(() => getComputedStyle(path()).stroke, { timeout: 2000 }).toBe("rgb(207, 34, 46)");
    expect(screen.container.querySelectorAll("[data-pulse='webhooks-to-kafka'] animateMotion").length).toBe(0);
    await screen.getByRole("button", { name: "Recover" }).click();
    await expect.poll(() => getComputedStyle(path()).stroke, { timeout: 2000 }).toBe("rgb(140, 149, 159)");
  });
```

(`rgb(140, 149, 159)` is `--color-conduit-edge` light; if the test environment's computed value differs, assert against a neutral edge such as `validator-to-scrubber` as the reference.)

- [ ] **Step 3: Docs.** README `Diagram` props table: `| \`edgeState\` | \`Record<string, EdgeState>\` | live overlay by edge id; never relayouts |`. New subsection "### Live state" after the props table with the spec's mapping table and a three-line example passing `edgeState`. CLAUDE.md Architecture item 3: append "`edgeState` is a per-edge live overlay (`live | idle | stale | down`, optional `rate` → pulse period via `pulseDurationFor`) read only by `EdgeLayer`, so state changes never relayout."

- [ ] **Step 4: Run** the full check and `npx vite build -c example/vite.config.ts`. Commit: `git add -A && git commit -m "Add outage simulation to the example and document edgeState"`.

## Self-review notes

Spec → tasks: types/helper/constants/mapping/prop → T1; example/docs → T2; every listed test present (pill tone via `lake-to-warehouse`, stale-hero, no-relayout). Names consistent: `edgeState`, `EdgeState`, `EdgeLevel`, `EDGE_LEVELS`, `pulseDurationFor`, `liveTone`.
