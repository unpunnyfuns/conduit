# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@unpunnyfuns/conduit` — a React 19 + Tailwind v4 library for lane-based architecture diagrams whose cards host live React content (charts). The layout engine is a port of [pr-lens](https://github.com/coldteadotai/pr-lens) (`packages/renderer/src/layout`, commit `b5309c3`); the SVG painter was replaced with React components. First consumer: a hand-authored chart of data entering the organisation.

Design spec: `docs/superpowers/specs/2026-09-08-lens-design.md`. Plan: `docs/superpowers/plans/2026-09-08-lens.md` (written under the working name "lens").

## Commands

```
npm test                 both projects (engine in Node, components in real Chromium)
npm run test:layout      engine only
npm run test:browser     components only (Playwright + Chromium)
npx vitest run test/layout/routing.test.ts          one file
npm run test:browser -- diagram                     browser tests matching a pattern
npm run lint / format / format:check / typecheck
npm run build            tsc → dist/ + copies theme.css
npm run example          Vite playground at example/
```

Node ≥ 22.12 to develop (Vitest 5); the package runs on ≥ 20.11. Before committing: `npm run lint && npm run format && npm run typecheck && npm test`.

## Architecture

Three layers, strictly one-directional:

1. **`src/schema/`** — zod 4. `parseDocument()` validates structure _and_ referential integrity (lane/node/edge/view ids) in one pass; throws `ConduitDocumentError`. Output types have defaults applied (`status`, `badges`, `edges`, `views` always present). Exported names are prefixed (`ConduitDocument`, `ConduitNode`) to avoid DOM globals.
2. **`src/layout/`** — pure functions, no React, no DOM. `layout(doc, { view?, cardHeights? })` → `Layout` with every box already shifted onto the canvas (`atlas` boxes equal the placed boxes). Pipeline: `scope` → `seating` (rank + explicit rows) → `architecture` (lane/card boxes, `LayoutGrid`) → `edges` (orthogonal routing through corridors/bands, ports, tracks, braid guard) → `congestion` (widens gaps when tracks compress) → `labels` (pill placement) → canvas shift. Published separately as `@unpunnyfuns/conduit/layout` and must stay importable in bare Node.
3. **`src/components/`** — `Diagram` memoises `layout()` and renders three absolutely-positioned layers: `LaneBand`s, one `EdgeLayer` svg (markers, `<animateMotion>` pulses, pills, hit paths), then `Card`s. The `Diagram` root is a scroll viewport; the fixed-size canvas is `[data-conduit-canvas]`. `fit` scales the canvas down to the viewport width. A card's body slot is filled by the `children(node)` render-prop. `highlight` decides what a selection lights, via the pure `traceFrom` in `src/layout/trace.ts`; traced edges are emphasised through `EdgeLayer`'s `emphasisedIds`, never by mutating the document.

## Invariants worth knowing

- **Determinism.** The engine reads no clock, random, DOM or font. Ties break by array index. Tests assert byte-identical JSON across calls and JSON round-trips, that a rename moves nothing, and that adding a node moves nothing in earlier lanes. Don't introduce Map-iteration-order dependence into output.
- **Status is colour only.** `status: neutral | positive | caution | critical` tints borders/strokes/badges. Upstream's `removed` also parked nodes, struck titles and exiled edges — none of that exists here; don't reintroduce layout branches on status.
- **Explicit rows are absolute.** `node.row` claims a grid row; two per row max (`ROW_OVERFULL`). When any row is pinned, ranks are not compressed. Automatic nodes skip claimed rows.
- **Card heights are declared, never measured.** `size: "compact" | "chart" | number`; `Card` reserves the body from `headerHeight` down. This is what lets a chart mount without relayout.
- **Colours come only from `src/theme.css` tokens** (`--color-conduit-*`, with a `.dark` block), consumed through Tailwind utilities. Consumers must add `@source "../node_modules/@unpunnyfuns/conduit"`.
- **Layout-coupled sizes** (`PILL_TEXT_SIZE`, `BADGE_HEIGHT`) are imported from `src/layout/design.ts` into components; purely cosmetic px values are Tailwind arbitraries.
- **Direction is a frame, not a second engine.** `frame.ts` feeds `architecture.ts`/`congestion.ts` the numbers for the chosen direction; the engine always lays out columns-with-rows-down and `layout()` transposes to screen space for `"down"`. `"right"` is guarded byte-identical by `test/layout/direction.test.ts`.

## Conventions

- Every relative import inside `src/`, `test/`, `example/` uses an explicit `.js` extension (also for `.tsx` modules).
- Functional style; only `Error` subclasses are classes. No inline end-of-line comments.
- `jsdom` is banned — component tests run in Chromium via `@vitest/browser-playwright` + `vitest-browser-react` (`render()` is async).
- `unicorn/no-array-sort` is off (the code sorts freshly spread copies). `oxfmt` ignores `docs/**`.
- `example/` imports the library as `@unpunnyfuns/conduit` via aliases in `example/vite.config.ts`, the vitest browser project, and `tsconfig.json` `paths`.
- Deferred to later: data-flow (sequence) diagrams, walkthrough tours, manifests. The schema leaves room (`flows` can be added without breaking documents).
