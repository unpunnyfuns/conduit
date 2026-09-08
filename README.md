# @unpunnyfuns/conduit

Lane-based architecture diagrams for React, with live content in every card.

A port of [pr-lens](https://github.com/coldteadotai/pr-lens)'s layout engine
with a React + Tailwind v4 renderer. Hand-author a document — lanes, nodes,
edges — and get a deterministic diagram whose cards can host any React
content, such as a chart.

## Install

```bash
npm install @unpunnyfuns/conduit
```

Peers: `react ^19`, `react-dom ^19`, `tailwindcss ^4`.

In your Tailwind CSS entry:

```css
@import "tailwindcss";
@import "@unpunnyfuns/conduit/theme.css";
@source "../node_modules/@unpunnyfuns/conduit";
```

The `@source` line is required: the components use Tailwind utilities and
Tailwind only emits the classes it can see.

## Structure

| Path                             | Contents                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `@unpunnyfuns/conduit`           | `Diagram`, `Card`, `LaneBand`, `EdgeLayer`, `Badge`, `KindIcon`, `parseDocument`, types |
| `@unpunnyfuns/conduit/layout`    | `layout()` — the pure engine, no React                                                  |
| `@unpunnyfuns/conduit/theme.css` | `--color-conduit-*` tokens with light and `.dark` values                                |

## Usage

```tsx
import { Diagram, parseDocument } from "@unpunnyfuns/conduit";

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
type ConduitDocumentInput = {
  version: 1;
  title: string;
  summary?: string;
  direction?: "right" | "down";
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

`direction: "down"` draws lanes as horizontal bands with cards flowing left
to right; `row` then means column. Default `"right"`.

### `Diagram` props

| Prop                         | Type                                                   | Notes                                                     |
| ---------------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| `doc`                        | `ConduitDocument`                                      | from `parseDocument`                                      |
| `view`                       | `string`                                               | id of a view to draw                                      |
| `selected`                   | `string[]`                                             | ids to keep lit; everything else dims                     |
| `highlight`                  | `"neighbours" \| "upstream" \| "downstream" \| "both"` | what a selection lights; traced edges draw at hero weight |
| `onNodeClick`, `onEdgeClick` | `(id) => void`                                         | cards become buttons when set                             |
| `cardHeights`                | `{ compact?; withSubtitle?; chart? }`                  | defaults 52 / 62 / 140                                    |
| `className`                  | `string`                                               | applied to the scroll viewport                            |
| `fit`                        | `boolean`                                              | scale the canvas down to fit; default `false`             |
| `children`                   | `(node) => ReactNode`                                  | body slot of every card that has one                      |

The root is a scroll viewport; size it with `className`. With `fit` the
canvas scales down to the viewport width (never up).

`layout()` runs during render and throws `ConduitLayoutError`
(`UNKNOWN_VIEW`, `ROW_OVERFULL`, `NOTHING_TO_RENDER`) for a document it
cannot draw; wrap `Diagram` in an error boundary if documents are
user-supplied.

### Layout without React

```ts
import { layout, traceFrom } from "@unpunnyfuns/conduit/layout";

const { width, height, nodes, edges, atlas } = layout(doc, { view: "storage" });

const { nodes, edges } = traceFrom(doc.edges, ["warehouse"], "upstream");
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
