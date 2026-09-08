import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { ingress } from "../../example/data/ingress.js";
import { Diagram } from "../../src/index.js";
import { layout } from "../../src/layout.js";

describe("Diagram", () => {
  it("renders one card per node, one band per lane and one path per edge", async () => {
    const screen = await render(<Diagram doc={ingress} />);
    expect(screen.container.querySelectorAll("[data-lens-node]").length).toBe(ingress.nodes.length);
    expect(screen.container.querySelectorAll("[data-lens-lane]").length).toBe(ingress.lanes.length);
    expect(screen.container.querySelectorAll("path[data-edge]").length).toBe(ingress.edges.length);
  });

  it("positions cards exactly where the atlas says", async () => {
    const screen = await render(<Diagram doc={ingress} />);
    const laid = layout(ingress);
    const root = screen.container.querySelector("[role='figure']") as HTMLElement;
    const origin = root.getBoundingClientRect();
    for (const [id, box] of Object.entries(laid.atlas.nodes)) {
      const card = screen.container.querySelector(`[data-lens-node='${id}']`) as HTMLElement;
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
    const root = screen.container.querySelector("[role='figure']") as HTMLElement;
    expect(root.getBoundingClientRect().width).toBeCloseTo(laid.width, 0);
    expect(root.getBoundingClientRect().height).toBeCloseTo(laid.height, 0);
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
      "[data-lens-node='warehouse'] [data-testid='chart-warehouse']",
    );
    expect(inside).not.toBeNull();
  });

  it("dims everything not selected or adjacent", async () => {
    const screen = await render(<Diagram doc={ingress} selected={["warehouse"]} />);
    const opacity = (selector: string) =>
      Number(getComputedStyle(screen.container.querySelector(selector) as Element).opacity);
    expect(opacity("[data-lens-node='warehouse']")).toBe(1);
    expect(opacity("[data-lens-node='partner-api']")).toBeLessThan(1);
    expect(opacity("g[data-edge-group='warehouse-to-ui']")).toBe(1);
    expect(opacity("g[data-edge-group='partner-to-kafka']")).toBeLessThan(1);
    expect(opacity("[data-lens-lane='store']")).toBe(1);
    expect(opacity("[data-lens-lane='sources']")).toBeLessThan(1);
  });

  it("reports node and edge clicks with ids", async () => {
    const onNodeClick = vi.fn();
    const onEdgeClick = vi.fn();
    const screen = await render(
      <Diagram doc={ingress} onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} />,
    );
    await screen.getByRole("button", { name: /^Warehouse/ }).click();
    expect(onNodeClick).toHaveBeenCalledWith("warehouse");
    const hit = screen.container.querySelector(
      "path[data-edge-hit='lake-to-warehouse']",
    ) as SVGPathElement;
    hit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onEdgeClick).toHaveBeenCalledWith("lake-to-warehouse");
  });

  it("renders a view's selection", async () => {
    const screen = await render(<Diagram doc={ingress} view="storage" />);
    expect(screen.container.querySelectorAll("[data-lens-lane]").length).toBe(2);
    expect(screen.container.querySelector("[data-lens-node='partner-api']")).toBeNull();
  });

  it("is a labelled figure with a text summary of edges", async () => {
    const screen = await render(<Diagram doc={ingress} />);
    const figure = screen.container.querySelector("[role='figure']");
    expect(figure?.getAttribute("aria-label")).toBe("Data ingress");
    await expect.element(screen.getByText("Raw lake → Warehouse, data")).toBeInTheDocument();
  });
});
