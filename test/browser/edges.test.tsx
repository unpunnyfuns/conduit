import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { EdgeLayer } from "../../src/components/EdgeLayer.js";
import { LaneBand } from "../../src/components/Lane.js";
import type { PlacedEdge } from "../../src/layout.js";

const edge = (
  id: string,
  extra: Partial<PlacedEdge["edge"]> = {},
  tone: PlacedEdge["tone"] = "neutral",
): PlacedEdge => ({
  edge: {
    id,
    from: "a",
    to: "b",
    kind: "call",
    emphasis: "normal",
    animated: false,
    status: tone,
    ...extra,
  },
  path: "M10,10 L100,10",
  tone,
});

describe("EdgeLayer", () => {
  it("draws one path per edge with an arrowhead marker", async () => {
    const screen = await render(
      <EdgeLayer width={200} height={100} edges={[edge("e1"), edge("e2")]} dimmedIds={new Set()} />,
    );
    const paths = screen.container.querySelectorAll("path[data-edge]");
    expect(paths.length).toBe(2);
    expect(paths[0]?.getAttribute("marker-end")).toMatch(/^url\(#.*mk-neutral\)$/);
  });

  it("uses the tone stroke", async () => {
    const screen = await render(
      <EdgeLayer
        width={200}
        height={100}
        edges={[edge("e1", {}, "critical")]}
        dimmedIds={new Set()}
      />,
    );
    const path = screen.container.querySelector("path[data-edge]") as SVGPathElement;
    expect(getComputedStyle(path).stroke).toBe("rgb(207, 34, 46)");
  });

  it("adds a travelling pulse for an animated edge and three for a hero", async () => {
    const screen = await render(
      <EdgeLayer
        width={200}
        height={100}
        edges={[
          edge("plain", { animated: true }),
          edge("hero", { animated: true, emphasis: "hero" }),
        ]}
        dimmedIds={new Set()}
      />,
    );
    expect(screen.container.querySelectorAll("[data-pulse='plain'] animateMotion").length).toBe(1);
    expect(screen.container.querySelectorAll("[data-pulse='hero'] animateMotion").length).toBe(3);
  });

  it("draws a label pill", async () => {
    const screen = await render(
      <EdgeLayer
        width={200}
        height={100}
        edges={[
          { ...edge("e1"), label: { text: "JSON", box: { x: 40, y: 2, width: 40, height: 15 } } },
        ]}
        dimmedIds={new Set()}
      />,
    );
    await expect.element(screen.getByText("JSON")).toBeInTheDocument();
  });

  it("dims edges in the set", async () => {
    const screen = await render(
      <EdgeLayer width={200} height={100} edges={[edge("e1")]} dimmedIds={new Set(["e1"])} />,
    );
    const group = screen.container.querySelector("g[data-edge-group='e1']") as SVGGElement;
    expect(Number(getComputedStyle(group).opacity)).toBeLessThan(1);
  });

  it("reports clicks through a hit path when a handler is given", async () => {
    const onEdgeClick = vi.fn();
    const screen = await render(
      <EdgeLayer
        width={200}
        height={100}
        edges={[edge("e1")]}
        dimmedIds={new Set()}
        onEdgeClick={onEdgeClick}
      />,
    );
    const hit = screen.container.querySelector("path[data-edge-hit='e1']") as SVGPathElement;
    hit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onEdgeClick).toHaveBeenCalledWith("e1");
  });

  it("is hidden from assistive tech", async () => {
    const screen = await render(
      <EdgeLayer width={200} height={100} edges={[]} dimmedIds={new Set()} />,
    );
    expect(screen.container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("LaneBand", () => {
  it("shows the header uppercase with the subtitle", async () => {
    const screen = await render(
      <LaneBand
        lane={{ id: "ingest", label: "Ingestion", subtitle: "Kafka", status: "neutral" }}
        box={{ x: 16, y: 44, width: 404, height: 300 }}
      />,
    );
    const header = screen.getByText("Ingestion · Kafka").element();
    expect(getComputedStyle(header).textTransform).toBe("uppercase");
  });
});
