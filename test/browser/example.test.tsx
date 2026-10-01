import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { App } from "../../example/App.js";

describe("example app", () => {
  it("mounts with sparklines in every chart card and toggles dark mode", async () => {
    const screen = await render(<App />);
    expect(screen.container.querySelectorAll("[data-conduit-node] polyline").length).toBe(5);
    await screen.getByRole("button", { name: "Dark" }).click();
    expect(screen.container.querySelector(".dark")).not.toBeNull();
    await expect.element(screen.getByRole("button", { name: "Light" })).toBeVisible();
  });

  it("selects a node on click and logs it", async () => {
    const screen = await render(<App />);
    await screen.getByRole("button", { name: "Warehouse", exact: true }).click();
    await expect.element(screen.getByText("node warehouse")).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Clear selection" })).toBeVisible();
  });

  it("toggles direction", async () => {
    const screen = await render(<App />);
    const before = (
      screen.container.querySelector("[data-conduit-lane='ingest']") as HTMLElement
    ).getBoundingClientRect();
    await screen.getByRole("button", { name: "Down", exact: true }).click();
    const after = (
      screen.container.querySelector("[data-conduit-lane='ingest']") as HTMLElement
    ).getBoundingClientRect();
    expect(after.width).toBeGreaterThan(before.width);
    await expect.element(screen.getByRole("button", { name: "Right" })).toBeVisible();
  });

  it("traces upstream by default when a card is selected", async () => {
    const screen = await render(<App />);
    await screen.getByRole("button", { name: "Warehouse", exact: true }).click();
    const opacity = (selector: string) =>
      Number(getComputedStyle(screen.container.querySelector(selector) as Element).opacity);
    await expect
      .poll(() => opacity("[data-conduit-node='analytics-ui']"), { timeout: 2000 })
      .toBeLessThan(1);
    expect(opacity("[data-conduit-node='partner-api']")).toBe(1);
  });

  it("switches highlight mode with a card selected", async () => {
    const screen = await render(<App />);
    await screen.getByRole("button", { name: "Warehouse", exact: true }).click();
    const opacity = (selector: string) =>
      Number(getComputedStyle(screen.container.querySelector(selector) as Element).opacity);
    await expect
      .poll(() => opacity("[data-conduit-node='analytics-ui']"), { timeout: 2000 })
      .toBeLessThan(1);

    await screen.getByRole("combobox", { name: "Highlight" }).selectOptions("downstream");
    await expect
      .poll(() => opacity("[data-conduit-node='analytics-ui']"), { timeout: 2000 })
      .toBe(1);
    await expect
      .poll(() => opacity("[data-conduit-node='partner-api']"), { timeout: 2000 })
      .toBeLessThan(1);

    await screen.getByRole("combobox", { name: "Highlight" }).selectOptions("both");
    await expect
      .poll(() => opacity("[data-conduit-node='analytics-ui']"), { timeout: 2000 })
      .toBe(1);
    await expect
      .poll(() => opacity("[data-conduit-node='partner-api']"), { timeout: 2000 })
      .toBe(1);
  });

  it("simulates an outage and recovers", async () => {
    const screen = await render(<App />);
    await screen.getByRole("button", { name: "Simulate outage" }).click();
    const path = () =>
      screen.container.querySelector("path[data-edge='batch-to-validator']") as SVGPathElement;
    await expect
      .poll(() => getComputedStyle(path()).stroke, { timeout: 2000 })
      .toBe("rgb(207, 34, 46)");
    expect(
      screen.container.querySelectorAll("[data-pulse='webhooks-to-kafka'] animateMotion").length,
    ).toBe(0);
    await screen.getByRole("button", { name: "Recover" }).click();
    await expect
      .poll(() => getComputedStyle(path()).stroke, { timeout: 2000 })
      .toBe("rgb(140, 149, 159)");
  });
});
