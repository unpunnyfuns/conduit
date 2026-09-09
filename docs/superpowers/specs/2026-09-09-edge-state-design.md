# edgeState — design

Date: 2026-09-09. Extends the conduit specs of 2026-09-08.

A per-edge live-state overlay so an app can flip a hop between live, idle, stale and down without touching the document or triggering a relayout.

## Goals

- Changing communication state is one prop change: `edgeState` keyed by edge id.
- No relayout: layout stays memoised on the document; a state change never re-runs `layout()`; components re-render as React normally would.
- State wins over the document's `animated`; the document's `status` is the base tone that `stale`/`down` override.

## Non-goals

- Measuring liveness, thresholds, or polling — the app's job.
- Node states (cards already carry live content).
- Animated transitions between states.

## Types

`src/components/pulse.ts` (pure, no React):

```ts
type EdgeLevel = "live" | "idle" | "stale" | "down"
type EdgeState = { level: EdgeLevel; rate?: number }
const EDGE_LEVELS: readonly EdgeLevel[]
/** Seconds per pulse cycle for a rate, clamped so extremes stay legible; undefined → PULSE_DURATION. */
const pulseDurationFor: (rate?: number) => number
```

`pulseDurationFor(rate)` = `PULSE_DURATION` when `rate` is undefined or ≤ 0; otherwise `clamp(PULSE_RATE_SCALE / rate, PULSE_DURATION_MIN, PULSE_DURATION_MAX)` with `PULSE_RATE_SCALE = 160`, `PULSE_DURATION_MIN = 0.6`, `PULSE_DURATION_MAX = 3` (new constants in `design.ts`). So rate 100 ≈ the default 1.6s, 1000 → 0.6s, 10 → 3s.

Exported from the package root: `EdgeLevel`, `EdgeState`, `EDGE_LEVELS`, `pulseDurationFor`.

## Mapping

`EdgeLayer` gains `edgeState?: Readonly<Record<string, EdgeState>>` (default empty); `Diagram` gains the same prop and forwards it.

Per edge, with `state = edgeState[edge.id]`:

| `state.level` | pulses | tone | stroke |
|---|---|---|---|
| absent | document `animated` | document | as today |
| `live` | on, `dur = pulseDurationFor(rate)` | document | as today |
| `idle` | off | document | as today |
| `stale` | off | `caution` | as today |
| `down` | off | `critical` | dashed (`stroke-dasharray: 5 4`) |

The overridden tone applies to the main path, the glow, the arrowhead marker and the label pill. Hero pulse count (3 for document-`hero`) is unchanged; a hero edge that is `live` with a `rate` runs its train at `pulseDurationFor(rate)`. `muted` still dims and still blocks selection emphasis; a muted edge that goes `down` turns critical but stays dimmed.

## Example

`example/App.tsx`: a "Simulate outage" toggle. On: `edgeState = { "batch-to-validator": { level: "down" }, "sftp-to-batch": { level: "stale" }, "partner-to-kafka": { level: "live", rate } }` where `rate` cycles 50 → 2000 on a 1s interval (so the pulse speed visibly changes); `webhooks-to-kafka` set to `idle`. Off: `undefined`.

## Tests

Node (`test/layout/pulse.test.ts`): `pulseDurationFor` undefined/0/100/1000/10 → 1.6/1.6/1.6/0.6/3; `EDGE_LEVELS` lists the four levels.

Browser (`test/browser/diagram.test.tsx`):
- `down` on `batch-to-validator`: main path computed stroke is the critical token colour, `stroke-dasharray` is not `none`, no `animateMotion` under `[data-pulse='batch-to-validator']`, pill (none on that edge — use `lake-to-warehouse` for the pill tone check: `down` → pill text uses the critical text colour).
- `live` with `rate: 1000` on `sftp-to-batch` (document not animated): exactly one `animateMotion` with `dur="0.6s"`.
- `idle` on `partner-to-kafka` (document animated): no `animateMotion`.
- `stale` on `kafka-to-validator` (document hero): stroke caution colour; still 3 `animateMotion`? No — stale means off: zero.
- No relayout: render with one `edgeState`, record `[data-conduit-node='warehouse']` rect and the canvas width; `rerender` with a different `edgeState`; both unchanged.

README: `edgeState` row in the `Diagram` props table and a short "Live state" subsection with the table above. CLAUDE.md: one sentence in Architecture item 3.

## Open questions

None.
