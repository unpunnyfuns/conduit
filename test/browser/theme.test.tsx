import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { cn } from "../../src/cn.js";

describe("theme tokens", () => {
  it("resolves bg-lens-card to the light token", async () => {
    const screen = await render(<div data-testid="box" className="bg-lens-card size-4" />);
    const box = screen.getByTestId("box").element();
    expect(getComputedStyle(box).backgroundColor).toBe("rgb(255, 255, 255)");
  });

  it("flips with the dark class, no re-render", async () => {
    const screen = await render(
      <div className="dark">
        <div data-testid="box" className="bg-lens-card size-4" />
      </div>,
    );
    const box = screen.getByTestId("box").element();
    expect(getComputedStyle(box).backgroundColor).toBe("rgb(28, 33, 40)");
  });
});

describe("cn", () => {
  it("drops falsy parts", () => {
    expect(cn("a", false, undefined, null, "", "b")).toBe("a b");
  });
});
