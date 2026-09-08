# @unpunnyfuns/lens

Lane-based architecture diagrams for React, with live content in every card.

A port of [pr-lens](https://github.com/coldteadotai/pr-lens)'s layout engine
with a React + Tailwind v4 renderer. Hand-author a document — lanes, nodes,
edges — and get a deterministic diagram whose cards can host any React
content, such as a chart.

## Install

```bash
npm install @unpunnyfuns/lens
```

Peers: `react ^19`, `react-dom ^19`, `tailwindcss ^4`.

In your Tailwind CSS entry:

```css
@import "tailwindcss";
@import "@unpunnyfuns/lens/theme.css";
@source "../node_modules/@unpunnyfuns/lens";
```

The `@source` line is required: the components use Tailwind utilities and
Tailwind only emits the classes it can see.

## Structure

| Path                          | Contents                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `@unpunnyfuns/lens`           | `Diagram`, `Card`, `LaneBand`, `EdgeLayer`, `Badge`, `KindIcon`, `parseDocument`, types |
| `@unpunnyfuns/lens/layout`    | `layout()` — the pure engine, no React                                                  |
| `@unpunnyfuns/lens/theme.css` | `--color-lens-*` tokens with light and `.dark` values                                   |

## Usage

```tsx
import { Diagram, parseDocument } from "@unpunnyfuns/lens";

const doc = parseDocument({
  version: 1,
  title: "Data ingress",
  lanes: [
    { id: "sources", label: "External sources", order: 0 },
    { id: "ingest", label: "Ingestion", order: 1 },
  ],
  nodes: [
    { id: "partner-api", label: "Partner API", kind: "external", lane: "sources", row: 0 },
    { id: "kafka", label: "Kafka ingest", kind: "queue", lane: "ingest", row: 0, size: "chart" },
  ],
  edges: [{ id: "api-to-kafka", from: "partner-api", to: "kafka", kind: "http", animated: true }],
});

export const Ingress = () => (
  <Diagram doc={doc} onNodeClick={(id) => console.log(id)}>
    {(node) => (node.size === "chart" ? <Throughput source={node.id} /> : null)}
  </Diagram>
);
```

### Document

```ts
type LensDocumentInput = {
  version: 1;
  title: string;
  summary?: string;
  lanes: { id; label; subtitle?; order?; status?; summary? }[];
  nodes: {
    id;
    label;
    kind: NodeKind;
    lane;
    row?: number;
    size?: "compact" | "chart" | number;
    status?: Status;
    badges?: { label; tone? }[];
    group?;
    subtitle?;
    summary?;
  }[];
  edges?: {
    id;
    from;
    to;
    kind: EdgeKind;
    label?;
    emphasis?: "normal" | "hero" | "muted";
    animated?;
    status?;
    summary?;
  }[];
  views?: {
    id;
    title;
    summary?;
    scope?: { kind: "all" } | { kind: "selection"; lanes?; nodes?; edges? };
    children?;
  }[];
};

type Status = "neutral" | "positive" | "caution" | "critical";
```

Two nodes with the same `row` in one lane sit side by side; a third throws
`ROW_OVERFULL`. Status affects colour only. Omit `row` to derive it from
edges. `size: "chart"` reserves a body slot; a number is a height in
pixels.

### `Diagram` props

| Prop                         | Type                                  | Notes                                 |
| ---------------------------- | ------------------------------------- | ------------------------------------- |
| `doc`                        | `LensDocument`                        | from `parseDocument`                  |
| `view`                       | `string`                              | id of a view to draw                  |
| `selected`                   | `string[]`                            | ids to keep lit; everything else dims |
| `onNodeClick`, `onEdgeClick` | `(id) => void`                        | cards become buttons when set         |
| `cardHeights`                | `{ compact?; withSubtitle?; chart? }` | defaults 52 / 62 / 140                |
| `children`                   | `(node) => ReactNode`                 | body slot of every card that has one  |

### Layout without React

```ts
import { layout } from "@unpunnyfuns/lens/layout";

const { width, height, nodes, edges, atlas } = layout(doc, { view: "storage" });
```

Same document, same geometry, every time.

## Development

```bash
npm test
npm run example
npm run build
```

`npm test` runs the engine tests in Node and the component tests in
Chromium; `npm run example` starts the Vite playground.

Developing requires Node ≥ 22.12 (Vitest 5); the published package runs on Node ≥ 20.11.

## License

MIT. Layout engine derived from pr-lens, © Coldtea AI.
