import { describe, expect, it } from "vitest";
import { assertNever } from "../../src/assert.js";

describe("assertNever", () => {
  it("throws with the message and the offending value", () => {
    expect(() => assertNever("nope" as never, "Unhandled thing")).toThrow(
      'Unhandled thing: "nope"',
    );
  });
});
