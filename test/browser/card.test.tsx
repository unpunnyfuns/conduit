import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { Badge } from "../../src/components/Badge.js";
import { Card } from "../../src/components/Card.js";
import { KindIcon } from "../../src/components/icons.js";
import type { LensNode } from "../../src/index.js";

const node: LensNode = {
  id: "kafka",
  label: "Kafka ingest",
  kind: "queue",
  lane: "ingest",
  subtitle: "topic: raw.events",
  status: "positive",
  badges: [{ label: "NEW", tone: "positive" }],
  size: "chart",
};

const box = { x: 40, y: 60, width: 372, height: 140 };

describe("Card", () => {
  it("is positioned from its box", async () => {
    const screen = await render(<Card node={node} box={box} headerHeight={62} />);
    const card = screen.getByRole("group").element() as HTMLElement;
    expect(card.style.left).toBe("40px");
    expect(card.style.top).toBe("60px");
    expect(card.style.width).toBe("372px");
    expect(card.style.height).toBe("140px");
  });

  it("shows title, subtitle and badges", async () => {
    const screen = await render(<Card node={node} box={box} headerHeight={62} />);
    await expect.element(screen.getByText("Kafka ingest")).toBeVisible();
    await expect.element(screen.getByText("topic: raw.events")).toBeVisible();
    await expect.element(screen.getByText("NEW")).toBeVisible();
  });

  it("renders children in a body slot below the header", async () => {
    const screen = await render(
      <Card node={node} box={box} headerHeight={62}>
        <div data-testid="chart" className="h-full" />
      </Card>,
    );
    const chart = screen.getByTestId("chart").element() as HTMLElement;
    const card = screen.getByRole("group").element() as HTMLElement;
    const chartTop = chart.getBoundingClientRect().top - card.getBoundingClientRect().top;
    expect(chartTop).toBeGreaterThanOrEqual(62);
    expect(chart.getBoundingClientRect().height).toBeGreaterThan(40);
  });

  it("is a button when clickable and reports its id", async () => {
    const onClick = vi.fn();
    const screen = await render(<Card node={node} box={box} headerHeight={62} onClick={onClick} />);
    await screen.getByRole("button", { name: /Kafka ingest/ }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("dims when asked", async () => {
    const screen = await render(<Card node={node} box={box} headerHeight={62} dimmed />);
    const card = screen.getByRole("group").element();
    expect(Number(getComputedStyle(card).opacity)).toBeLessThan(1);
  });

  it("tints its border by status", async () => {
    const screen = await render(<Card node={node} box={box} headerHeight={62} />);
    const card = screen.getByRole("group").element();
    expect(getComputedStyle(card).borderColor).toBe("rgba(31, 136, 61, 0.55)");
  });
});

describe("Badge", () => {
  it("renders the label uppercase with the tone colours", async () => {
    const screen = await render(<Badge label="deprecated" tone="critical" />);
    const badge = screen.getByText("deprecated").element();
    expect(getComputedStyle(badge).textTransform).toBe("uppercase");
    expect(getComputedStyle(badge).color).toBe("rgb(164, 14, 38)");
  });
});

describe("KindIcon", () => {
  it("draws something for every kind", async () => {
    const kinds = [
      "service",
      "app",
      "module",
      "function",
      "route",
      "job",
      "queue",
      "datastore",
      "cache",
      "external",
      "ui",
      "config",
      "test",
      "package",
      "other",
    ] as const;
    for (const kind of kinds) {
      const screen = await render(<KindIcon kind={kind} />);
      const svg = screen.container.querySelector("svg");
      expect(svg, kind).not.toBeNull();
      expect(svg?.childElementCount, kind).toBeGreaterThan(0);
      await screen.unmount();
    }
  });
});
