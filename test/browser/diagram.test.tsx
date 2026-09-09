import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { ingress } from "../../example/data/ingress.js";
import { Diagram } from "../../src/index.js";
import { layout } from "../../src/layout.js";

describe("Diagram", () => {
  it("renders one card per node, one band per lane and one path per edge", async () => {
    const screen = await render(<Diagram doc={ingress} />);
    expect(screen.container.querySelectorAll("[data-conduit-node]").length).toBe(
      ingress.nodes.length,
    );
    expect(screen.container.querySelectorAll("[data-conduit-lane]").length).toBe(
      ingress.lanes.length,
    );
    expect(screen.container.querySelectorAll("path[data-edge]").length).toBe(ingress.edges.length);
  });

  it("positions cards exactly where the atlas says", async () => {
    const screen = await render(<Diagram doc={ingress} />);
    const laid = layout(ingress);
    const canvas = screen.container.querySelector("[data-conduit-canvas]") as HTMLElement;
    const origin = canvas.getBoundingClientRect();
    for (const [id, box] of Object.entries(laid.atlas.nodes)) {
      const card = screen.container.querySelector(`[data-conduit-node='${id}']`) as HTMLElement;
      const rect = card.getBoundingClientRect();
      expect(rect.left - origin.left, id).toBeCloseTo(box.x, 0);
      expect(rect.top - origin.top, id).toBeCloseTo(box.y, 0);
      expect(rect.width, id).toBeCloseTo(box.width, 0);
      expect(rect.height, id).toBeCloseTo(box.height, 0);
    }
  });

  it("sizes itself to the layout", async () => {
    const screen = await render(<Diagram doc={ingress} />);
    const laid = layout(ingress);
    const canvas = screen.container.querySelector("[data-conduit-canvas]") as HTMLElement;
    expect(canvas.getBoundingClientRect().width).toBeCloseTo(laid.width, 0);
    expect(canvas.getBoundingClientRect().height).toBeCloseTo(laid.height, 0);
  });

  it("scrolls when constrained", async () => {
    const screen = await render(<Diagram doc={ingress} className="h-[200px] w-[400px]" />);
    const figure = screen.container.querySelector("[role='figure']") as HTMLElement;
    expect(figure.scrollWidth).toBeGreaterThan(figure.clientWidth);
    expect(figure.scrollHeight).toBeGreaterThan(figure.clientHeight);
  });

  it("fit scales down to the viewport width", async () => {
    await page.viewport(800, 600);
    const screen = await render(<Diagram doc={ingress} fit className="w-[500px]" />);
    const canvas = screen.container.querySelector("[data-conduit-canvas]") as HTMLElement;
    await expect
      .poll(() => canvas.getBoundingClientRect().width, { timeout: 2000 })
      .toBeCloseTo(500, 0);
    expect((canvas.style as CSSStyleDeclaration).transform).toContain("scale(");
  });

  it("does not scale the canvas without fit", async () => {
    const screen = await render(<Diagram doc={ingress} className="w-[500px]" />);
    const laid = layout(ingress);
    const canvas = screen.container.querySelector("[data-conduit-canvas]") as HTMLElement;
    expect(canvas.getBoundingClientRect().width).toBeCloseTo(laid.width, 0);
  });

  it("puts render-prop content inside chart cards only", async () => {
    const screen = await render(
      <Diagram doc={ingress}>
        {(node) => (node.size === "chart" ? <div data-testid={`chart-${node.id}`} /> : null)}
      </Diagram>,
    );
    expect(screen.container.querySelectorAll("[data-testid^='chart-']").length).toBe(
      ingress.nodes.filter((node) => node.size === "chart").length,
    );
    const inside = screen.container.querySelector(
      "[data-conduit-node='warehouse'] [data-testid='chart-warehouse']",
    );
    expect(inside).not.toBeNull();
  });

  it("dims everything not selected or adjacent", async () => {
    const screen = await render(<Diagram doc={ingress} selected={["warehouse"]} />);
    const opacity = (selector: string) =>
      Number(getComputedStyle(screen.container.querySelector(selector) as Element).opacity);
    expect(opacity("[data-conduit-node='warehouse']")).toBe(1);
    expect(opacity("[data-conduit-node='partner-api']")).toBeLessThan(1);
    expect(opacity("g[data-edge-group='warehouse-to-ui']")).toBe(1);
    expect(opacity("g[data-edge-group='partner-to-kafka']")).toBeLessThan(1);
    expect(opacity("[data-conduit-lane='store']")).toBe(1);
    expect(opacity("[data-conduit-lane='sources']")).toBeLessThan(1);
  });

  it("lights the whole upstream path and emphasises its edges", async () => {
    const screen = await render(
      <Diagram doc={ingress} selected={["warehouse"]} highlight="upstream" />,
    );
    const opacity = (selector: string) =>
      Number(getComputedStyle(screen.container.querySelector(selector) as Element).opacity);
    expect(opacity("[data-conduit-node='partner-api']")).toBe(1);
    expect(opacity("[data-conduit-node='raw-lake']")).toBe(1);
    expect(opacity("[data-conduit-node='analytics-ui']")).toBeLessThan(1);
    expect(opacity("g[data-edge-group='partner-to-kafka']")).toBe(1);
    expect(opacity("g[data-edge-group='warehouse-to-ui']")).toBeLessThan(1);
    const traced = screen.container.querySelector(
      "path[data-edge='partner-to-kafka']",
    ) as SVGPathElement;
    const untraced = screen.container.querySelector(
      "path[data-edge='warehouse-to-ui']",
    ) as SVGPathElement;
    expect(parseFloat(getComputedStyle(traced).strokeWidth)).toBeCloseTo(2.25, 1);
    expect(parseFloat(getComputedStyle(untraced).strokeWidth)).toBeCloseTo(1.5, 1);
  });

  it("keeps a muted edge muted on a traced path", async () => {
    const screen = await render(
      <Diagram doc={ingress} selected={["legacy-ftp"]} highlight="upstream" />,
    );
    const muted = screen.container.querySelector(
      "path[data-edge='batch-to-legacy']",
    ) as SVGPathElement;
    const mutedGroup = screen.container.querySelector(
      "g[data-edge-group='batch-to-legacy']",
    ) as Element;
    const traced = screen.container.querySelector(
      "path[data-edge='sftp-to-batch']",
    ) as SVGPathElement;
    expect(parseFloat(getComputedStyle(muted).strokeWidth)).toBeCloseTo(1.5, 1);
    expect(Number(getComputedStyle(mutedGroup).opacity)).toBeLessThan(1);
    expect(parseFloat(getComputedStyle(traced).strokeWidth)).toBeCloseTo(2.25, 1);
  });

  it("keeps pulse count unchanged when a traced edge is emphasised", async () => {
    const screen = await render(
      <Diagram doc={ingress} selected={["warehouse"]} highlight="upstream" />,
    );
    expect(
      screen.container.querySelectorAll("[data-pulse='partner-to-kafka'] animateMotion").length,
    ).toBe(1);
  });

  it("reports node and edge clicks with ids", async () => {
    const onNodeClick = vi.fn();
    const onEdgeClick = vi.fn();
    const screen = await render(
      <Diagram doc={ingress} onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} />,
    );
    await screen.getByRole("button", { name: "Warehouse", exact: true }).click();
    expect(onNodeClick).toHaveBeenCalledWith("warehouse");
    const hit = screen.container.querySelector(
      "path[data-edge-hit='lake-to-warehouse']",
    ) as SVGPathElement;
    hit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onEdgeClick).toHaveBeenCalledWith("lake-to-warehouse");
  });

  it("renders a view's selection", async () => {
    const screen = await render(<Diagram doc={ingress} view="storage" />);
    expect(screen.container.querySelectorAll("[data-conduit-lane]").length).toBe(2);
    expect(screen.container.querySelector("[data-conduit-node='partner-api']")).toBeNull();
  });

  it("is a labelled figure with a text summary of edges", async () => {
    const screen = await render(<Diagram doc={ingress} />);
    const figure = screen.container.querySelector("[role='figure']");
    expect(figure?.getAttribute("aria-label")).toBe("Data ingress");
    await expect.element(screen.getByText("Raw lake → Warehouse, data")).toBeInTheDocument();
  });

  it("edges are keyboard reachable", async () => {
    // `sr-only` clip-paths its contents to zero area, so a real pointer
    // click can never land on this button (that is the point: it is a
    // screen-reader/keyboard-only route). A native `.click()` on the
    // element exercises the same activation a keyboard user's Enter would,
    // without depending on Playwright's pointer hit-testing.
    const onEdgeClick = vi.fn();
    const screen = await render(<Diagram doc={ingress} onEdgeClick={onEdgeClick} />);
    const button = screen.getByRole("button", { name: "Raw lake → Warehouse, data" });
    (button.element() as HTMLButtonElement).click();
    expect(onEdgeClick).toHaveBeenCalledWith("lake-to-warehouse");
  });

  it("draws direction down as stacked bands with cards flowing right", async () => {
    const screen = await render(<Diagram doc={{ ...ingress, direction: "down" }} />);
    const top = (selector: string) =>
      (screen.container.querySelector(selector) as HTMLElement).getBoundingClientRect().top;
    const left = (selector: string) =>
      (screen.container.querySelector(selector) as HTMLElement).getBoundingClientRect().left;
    expect(top("[data-conduit-lane='ingest']")).toBeGreaterThan(
      top("[data-conduit-lane='sources']"),
    );
    expect(top("[data-conduit-lane='store']")).toBeGreaterThan(top("[data-conduit-lane='ingest']"));
    expect(left("[data-conduit-node='batch-loader']")).toBeGreaterThan(
      left("[data-conduit-node='kafka-ingest']"),
    );
    expect(top("[data-conduit-node='batch-loader']")).toBeCloseTo(
      top("[data-conduit-node='kafka-ingest']"),
      0,
    );
  });

  it("marks a down edge critical, dashed and unpulsed", async () => {
    const screen = await render(
      <Diagram doc={ingress} edgeState={{ "batch-to-validator": { level: "down" } }} />,
    );
    const path = screen.container.querySelector(
      "path[data-edge='batch-to-validator']",
    ) as SVGPathElement;
    expect(getComputedStyle(path).stroke).toBe("rgb(207, 34, 46)");
    expect(getComputedStyle(path).strokeDasharray).not.toBe("none");
    expect(
      screen.container.querySelectorAll("[data-pulse='batch-to-validator'] animateMotion").length,
    ).toBe(0);
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
    expect(
      screen.container.querySelectorAll("[data-pulse='partner-to-kafka'] animateMotion").length,
    ).toBe(0);
  });

  it("turns a stale hero edge caution and stops its train", async () => {
    const screen = await render(
      <Diagram doc={ingress} edgeState={{ "kafka-to-validator": { level: "stale" } }} />,
    );
    const path = screen.container.querySelector(
      "path[data-edge='kafka-to-validator']",
    ) as SVGPathElement;
    expect(getComputedStyle(path).stroke).toBe("rgb(191, 135, 0)");
    expect(
      screen.container.querySelectorAll("[data-pulse='kafka-to-validator'] animateMotion").length,
    ).toBe(0);
  });

  it("does not relayout when edge state changes", async () => {
    const screen = await render(
      <Diagram doc={ingress} edgeState={{ "partner-to-kafka": { level: "live", rate: 50 } }} />,
    );
    const card = () =>
      (
        screen.container.querySelector("[data-conduit-node='warehouse']") as HTMLElement
      ).getBoundingClientRect();
    const canvas = () =>
      (
        screen.container.querySelector("[data-conduit-canvas]") as HTMLElement
      ).getBoundingClientRect().width;
    const before = { card: card(), canvas: canvas() };
    await screen.rerender(
      <Diagram
        doc={ingress}
        edgeState={{
          "partner-to-kafka": { level: "down" },
          "lake-to-warehouse": { level: "stale" },
        }}
      />,
    );
    expect(card()).toEqual(before.card);
    expect(canvas()).toBe(before.canvas);
  });
});
