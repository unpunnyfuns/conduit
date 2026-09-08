import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { App } from "../../example/App.js";

describe("example app", () => {
  it("mounts with sparklines in every chart card and toggles dark mode", async () => {
    const screen = await render(<App />);
    expect(screen.container.querySelectorAll("[data-lens-node] polyline").length).toBe(5);
    await screen.getByRole("button", { name: "Dark" }).click();
    expect(screen.container.querySelector(".dark")).not.toBeNull();
    await expect.element(screen.getByRole("button", { name: "Light" })).toBeVisible();
  });

  it("selects a node on click and logs it", async () => {
    const screen = await render(<App />);
    await screen.getByRole("button", { name: /^Warehouse/ }).click();
    await expect.element(screen.getByText("node warehouse")).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Clear selection" })).toBeVisible();
  });
});
