import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { ingress } from "../../example/data/ingress.js";
import { EdgeDetail } from "../../src/components/detail/EdgeDetail.js";
import { NodeDetail } from "../../src/components/detail/NodeDetail.js";
import { Popover } from "../../src/components/detail/Popover.js";
import { Diagram, parseDocument } from "../../src/index.js";

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

  it("ignores mousedown on an edge hit path or a card's header button, but not its body", async () => {
    const onClose = vi.fn();
    const screen = await render(
      <div data-conduit-canvas style={{ position: "relative", width: 800, height: 600 }}>
        <div data-conduit-node="x" data-testid="card">
          <button type="button" data-testid="card-button">
            header
          </button>
        </div>
        <div data-edge-hit="y" data-testid="edge-hit" />
        <Popover anchor={anchor} canvas={canvas} labelledBy="t" onClose={onClose}>
          <h3 id="t">Title</h3>
        </Popover>
      </div>,
    );
    screen
      .getByTestId("edge-hit")
      .element()
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    screen
      .getByTestId("card-button")
      .element()
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
    screen
      .getByTestId("card")
      .element()
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
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

  it("lists parallel edges to the same neighbour separately", async () => {
    const errorSpy = vi.spyOn(console, "error");
    const doc = parseDocument({
      version: 1,
      title: "Parallel edges",
      lanes: [{ id: "lane", label: "Lane" }],
      nodes: [
        { id: "a", label: "A", kind: "service", lane: "lane" },
        { id: "b", label: "B", kind: "service", lane: "lane" },
      ],
      edges: [
        { id: "one", from: "a", to: "b", kind: "call" },
        { id: "two", from: "a", to: "b", kind: "call" },
      ],
    });
    const a = doc.nodes.find((n) => n.id === "a")!;
    const docLabelOf = (id: string) => doc.nodes.find((n) => n.id === id)?.label ?? id;
    const screen = await render(
      <NodeDetail node={a} edges={doc.edges} labelOf={docLabelOf} titleId="t" />,
    );
    await expect.element(screen.getByText("Sends to")).toBeVisible();
    expect(screen.getByText("B").elements().length).toBe(2);
    for (const call of errorSpy.mock.calls) {
      expect(call.join(" ")).not.toContain("key");
    }
    errorSpy.mockRestore();
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

const dialog = (screen: Awaited<ReturnType<typeof render>>) =>
  screen.container.querySelector("[data-conduit-popover]") as HTMLElement | null;

const Controlled = () => {
  const [d, setD] = useState<string | undefined>(undefined);
  return <Diagram doc={ingress} detail="popover" detailFor={d} onDetailChange={setD} />;
};

const Tick = () => {
  const [tick, setTick] = useState(0);
  return (
    <>
      <button data-testid="tick" type="button" onClick={() => setTick((t) => t + 1)}>
        {tick}
      </button>
      <Diagram doc={ingress} detail="popover" onDetailChange={(id) => void id} />
    </>
  );
};

describe("Diagram detail", () => {
  it("opens a node popover on click, inside the canvas, and toggles closed", async () => {
    const screen = await render(<Diagram doc={ingress} detail="popover" />);
    await screen.getByRole("button", { name: "Warehouse", exact: true }).click();
    await expect.element(screen.getByRole("dialog", { name: "Warehouse" })).toBeVisible();
    const canvasRect = (
      screen.container.querySelector("[data-conduit-canvas]") as HTMLElement
    ).getBoundingClientRect();
    const box = dialog(screen)!.getBoundingClientRect();
    expect(box.left).toBeGreaterThanOrEqual(canvasRect.left - 1);
    expect(box.right).toBeLessThanOrEqual(canvasRect.right + 1);
    await screen.getByRole("button", { name: "Warehouse", exact: true }).click();
    await expect.poll(() => dialog(screen)).toBeNull();
  });

  it("places the popover left of the rightmost card", async () => {
    const screen = await render(<Diagram doc={ingress} detail="popover" />);
    await screen.getByRole("button", { name: "Analytics UI", exact: true }).click();
    const card = (
      screen.container.querySelector("[data-conduit-node='analytics-ui']") as HTMLElement
    ).getBoundingClientRect();
    await expect
      .poll(() => dialog(screen)?.getBoundingClientRect().right ?? Infinity)
      .toBeLessThanOrEqual(card.left + 1);
  });

  it("works in direction down", async () => {
    const screen = await render(
      <Diagram doc={{ ...ingress, direction: "down" }} detail="popover" />,
    );
    await screen.getByRole("button", { name: "Warehouse", exact: true }).click();
    await expect.element(screen.getByRole("dialog", { name: "Warehouse" })).toBeVisible();
  });

  it("appends renderDetail content", async () => {
    const screen = await render(
      <Diagram
        doc={ingress}
        detail="popover"
        renderDetail={(t) => (t.kind === "node" ? <div>Owner: data-platform</div> : null)}
      />,
    );
    await screen.getByRole("button", { name: "Warehouse", exact: true }).click();
    await expect.element(screen.getByText("Owner: data-platform")).toBeVisible();
  });

  it("opens an edge popover from its hit path without an onEdgeClick prop", async () => {
    const screen = await render(
      <Diagram
        doc={ingress}
        detail="popover"
        edgeState={{ "lake-to-warehouse": { level: "stale" } }}
      />,
    );
    const hit = screen.container.querySelector(
      "path[data-edge-hit='lake-to-warehouse']",
    ) as SVGPathElement;
    hit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await expect
      .element(screen.getByRole("dialog", { name: "Raw lake → Warehouse" }))
      .toBeVisible();
    expect(screen.container.textContent).toContain("State: stale");
  });

  it("switches to a neighbour from the connections list", async () => {
    const screen = await render(<Diagram doc={ingress} detail="popover" />);
    await screen.getByRole("button", { name: "Warehouse", exact: true }).click();
    await screen
      .getByRole("dialog")
      .getByRole("button", { name: /Raw lake/ })
      .click();
    await expect.element(screen.getByRole("dialog", { name: "Raw lake" })).toBeVisible();
    await expect.poll(() => document.activeElement?.getAttribute("role")).toBe("dialog");
  });

  it("is controllable", async () => {
    const onDetailChange = vi.fn();
    const screen = await render(
      <Diagram
        doc={ingress}
        detail="popover"
        detailFor="warehouse"
        onDetailChange={onDetailChange}
      />,
    );
    await expect.element(screen.getByRole("dialog", { name: "Warehouse" })).toBeVisible();
    await screen.getByRole("button", { name: "Warehouse", exact: true }).click();
    expect(onDetailChange).toHaveBeenCalledWith(undefined);
    await expect.element(screen.getByRole("dialog", { name: "Warehouse" })).toBeVisible();
  });

  it("does not render hit paths or a popover when detail is none", async () => {
    const screen = await render(<Diagram doc={ingress} />);
    expect(screen.container.querySelector("path[data-edge-hit]")).toBeNull();
    expect(dialog(screen)).toBeNull();
  });

  it("closes in controlled mode when the parent stores the reported id", async () => {
    const screen = await render(<Controlled />);
    await screen.getByRole("button", { name: "Warehouse", exact: true }).click();
    await expect.element(screen.getByRole("dialog", { name: "Warehouse" })).toBeVisible();
    await screen.getByRole("button", { name: "Warehouse", exact: true }).click();
    await expect.poll(() => dialog(screen)).toBeNull();
  });

  it("does not re-open after detail is turned off and on", async () => {
    const screen = await render(<Diagram doc={ingress} detail="popover" />);
    await screen.getByRole("button", { name: "Warehouse", exact: true }).click();
    await expect.element(screen.getByRole("dialog", { name: "Warehouse" })).toBeVisible();
    await screen.rerender(<Diagram doc={ingress} detail="none" />);
    await expect.poll(() => dialog(screen)).toBeNull();
    await screen.rerender(<Diagram doc={ingress} detail="popover" />);
    await expect.poll(() => dialog(screen)).toBeNull();
  });

  it("closes when a view scopes the target out", async () => {
    const screen = await render(<Diagram doc={ingress} detail="popover" />);
    await screen.getByRole("button", { name: "Warehouse", exact: true }).click();
    await expect.element(screen.getByRole("dialog", { name: "Warehouse" })).toBeVisible();
    await screen.rerender(<Diagram doc={ingress} detail="popover" view="ingestion-path" />);
    await expect.poll(() => dialog(screen)).toBeNull();
    await screen.rerender(<Diagram doc={ingress} detail="popover" />);
    await expect.poll(() => dialog(screen)).toBeNull();
  });

  it("keeps focus in the dialog across an unrelated re-render with an inline onDetailChange", async () => {
    const screen = await render(<Tick />);
    await screen.getByRole("button", { name: "Warehouse", exact: true }).click();
    await expect.poll(() => document.activeElement?.getAttribute("role")).toBe("dialog");
    // A plain click event, not a full click() gesture: this isolates the
    // re-render churn this test targets from the (separately covered)
    // outside-mousedown-closes behaviour, which a real mousedown on an
    // unrelated sibling button would also legitimately trigger.
    screen
      .getByTestId("tick")
      .element()
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await expect.poll(() => document.activeElement?.getAttribute("role")).toBe("dialog");
  });

  it("a click on a card body closes the popover", async () => {
    const screen = await render(<Diagram doc={ingress} detail="popover" />);
    await screen.getByRole("button", { name: "Warehouse", exact: true }).click();
    await expect.element(screen.getByRole("dialog", { name: "Warehouse" })).toBeVisible();
    const card = screen.container.querySelector(
      "[data-conduit-node='kafka-ingest']",
    ) as HTMLElement;
    card.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await expect.poll(() => dialog(screen)).toBeNull();
  });

  it("an sr-only edge button does not flash the popover", async () => {
    const screen = await render(
      <Diagram doc={ingress} detail="popover" onEdgeClick={(id) => void id} />,
    );
    await screen.getByRole("button", { name: "Warehouse", exact: true }).click();
    await expect.element(screen.getByRole("dialog", { name: "Warehouse" })).toBeVisible();
    const btn = screen.container.querySelector(
      "[data-conduit-edge-list] button",
    ) as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await expect.poll(() => dialog(screen)?.textContent?.includes("→") ?? false).toBe(true);
    await expect
      .poll(() => {
        const dlg = dialog(screen);
        return (
          dlg !== null && (dlg === document.activeElement || dlg.contains(document.activeElement))
        );
      })
      .toBe(true);
  });
});
