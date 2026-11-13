import { describe, expect, it } from "vitest";
import { getActionCoverVariant } from "../actionCover";

describe("getActionCoverVariant", () => {
  it("returns the same variant for the same id", () => {
    expect(getActionCoverVariant("action-42")).toEqual(
      getActionCoverVariant("action-42"),
    );
  });

  it("spreads different ids over more than one variant", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `action-${i}`);
    const keys = new Set(ids.map((id) => getActionCoverVariant(id).key));

    expect(keys.size).toBeGreaterThan(1);
  });
});
