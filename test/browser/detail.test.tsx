import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { ingress } from "../../example/data/ingress.js";
import { EdgeDetail } from "../../src/components/detail/EdgeDetail.js";
import { NodeDetail } from "../../src/components/detail/NodeDetail.js";
import { Popover } from "../../src/components/detail/Popover.js";

const canvas = { width: 800, height: 600 };
const anchor = { x: 40, y: 40, width: 200, height: 52 };

describe("Popover", () => {
  it("is a labelled dialog that takes focus", async () => {
    const screen = await render(
      <div data-conduit-canvas style={{ position: "relative", width: 800, height: 600 }}>
        <Popover anchor={anchor} canvas={canvas} labelledBy="t" onClose={() => {}}>
          <h3 id="t">Title</h3>
        </Popover>
      </div>,
    );
    const dialog = screen.getByRole("dialog", { name: "Title" }).element() as HTMLElement;
    await expect.poll(() => document.activeElement === dialog).toBe(true);
    await expect.poll(() => getComputedStyle(dialog).visibility).toBe("visible");
  });

  it("closes on Escape and on outside mousedown, not on inside mousedown", async () => {
    const onClose = vi.fn();
    const screen = await render(
      <div data-conduit-canvas style={{ position: "relative", width: 800, height: 600 }}>
        <button type="button" data-testid="outside">
          outside
        </button>
        <Popover anchor={anchor} canvas={canvas} labelledBy="t" onClose={onClose}>
          <h3 id="t">Title</h3>
          <button type="button" data-testid="inside">
            inside
          </button>
        </Popover>
      </div>,
    );
    screen
      .getByTestId("inside")
      .element()
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
    screen
      .getByTestId("outside")
      .element()
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("ignores mousedown on a card or edge hit path", async () => {
    const onClose = vi.fn();
    const screen = await render(
      <div data-conduit-canvas style={{ position: "relative", width: 800, height: 600 }}>
        <div data-conduit-node="x" data-testid="card" />
        <Popover anchor={anchor} canvas={canvas} labelledBy="t" onClose={onClose}>
          <h3 id="t">Title</h3>
        </Popover>
      </div>,
    );
    screen
      .getByTestId("card")
      .element()
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("restores focus on unmount", async () => {
    const screen = await render(
      <button type="button" data-testid="opener">
        open
      </button>,
    );
    const opener = screen.getByTestId("opener").element() as HTMLElement;
    opener.focus();
    await screen.rerender(
      <>
        <button type="button" data-testid="opener">
          open
        </button>
        <div data-conduit-canvas style={{ position: "relative", width: 800, height: 600 }}>
          <Popover anchor={anchor} canvas={canvas} labelledBy="t" onClose={() => {}}>
            <h3 id="t">Title</h3>
          </Popover>
        </div>
      </>,
    );
    await expect.poll(() => document.activeElement?.getAttribute("role")).toBe("dialog");
    await screen.rerender(
      <button type="button" data-testid="opener">
        open
      </button>,
    );
    await expect.poll(() => document.activeElement?.getAttribute("data-testid")).toBe("opener");
  });

  it("focuses once, not on every re-measure", async () => {
    const screen = await render(
      <div data-conduit-canvas style={{ position: "relative", width: 800, height: 600 }}>
        <Popover anchor={anchor} canvas={canvas} labelledBy="t" onClose={() => {}}>
          <h3 id="t">Title</h3>
          <button type="button" data-testid="inner">
            inner
          </button>
        </Popover>
      </div>,
    );
    const dialog = screen.getByRole("dialog", { name: "Title" }).element() as HTMLElement;
    await expect.poll(() => document.activeElement === dialog).toBe(true);
    const inner = screen.getByTestId("inner").element() as HTMLElement;
    inner.focus();
    await screen.rerender(
      <div data-conduit-canvas style={{ position: "relative", width: 800, height: 600 }}>
        <Popover anchor={anchor} canvas={canvas} labelledBy="t" onClose={() => {}}>
          <h3 id="t">Title</h3>
          <button type="button" data-testid="inner">
            inner
          </button>
          <div style={{ height: 120 }} />
        </Popover>
      </div>,
    );
    await expect.poll(() => document.activeElement?.getAttribute("data-testid")).toBe("inner");
  });
});

const labelOf = (id: string) => ingress.nodes.find((n) => n.id === id)?.label ?? id;

describe("NodeDetail", () => {
  const warehouse = ingress.nodes.find((n) => n.id === "warehouse")!;

  it("shows title, summary and connections", async () => {
    const screen = await render(
      <NodeDetail
        node={{ ...warehouse, summary: "Nightly dbt models." }}
        edges={ingress.edges}
        labelOf={labelOf}
        titleId="t"
      />,
    );
    await expect.element(screen.getByRole("heading", { name: "Warehouse" })).toBeVisible();
    await expect.element(screen.getByText("Nightly dbt models.")).toBeVisible();
    await expect.element(screen.getByText("Receives from")).toBeVisible();
    await expect.element(screen.getByText("Raw lake")).toBeVisible();
    await expect.element(screen.getByText("Sends to")).toBeVisible();
    await expect.element(screen.getByText("Analytics UI")).toBeVisible();
    await expect.element(screen.getByText("Reporting job")).toBeVisible();
  });

  it("reports a neighbour selection", async () => {
    const onSelect = vi.fn();
    const screen = await render(
      <NodeDetail
        node={warehouse}
        edges={ingress.edges}
        labelOf={labelOf}
        titleId="t"
        onSelect={onSelect}
      />,
    );
    await screen.getByRole("button", { name: /Raw lake/ }).click();
    expect(onSelect).toHaveBeenCalledWith("raw-lake");
  });

  it("omits empty sections", async () => {
    const source = ingress.nodes.find((n) => n.id === "partner-api")!;
    const screen = await render(
      <NodeDetail node={source} edges={ingress.edges} labelOf={labelOf} titleId="t" />,
    );
    expect(screen.container.textContent).not.toContain("Receives from");
    expect(screen.container.textContent).toContain("Sends to");
  });
});

describe("EdgeDetail", () => {
  const edge = ingress.edges.find((e) => e.id === "lake-to-warehouse")!;

  it("shows endpoints, kind, label and state", async () => {
    const screen = await render(
      <EdgeDetail
        edge={edge}
        fromLabel="Raw lake"
        toLabel="Warehouse"
        titleId="t"
        state={{ level: "stale" }}
      />,
    );
    await expect
      .element(screen.getByRole("heading", { name: "Raw lake → Warehouse" }))
      .toBeVisible();
    expect(screen.container.textContent).toContain("data");
    expect(screen.container.textContent).toContain("dbt");
    expect(screen.container.textContent).toContain("State: stale");
  });
});
