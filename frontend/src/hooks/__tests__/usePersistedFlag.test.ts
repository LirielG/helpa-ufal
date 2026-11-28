import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@/test";
import { usePersistedFlag } from "@/hooks/usePersistedFlag";

const KEY = "helpa.testFlag";

describe("usePersistedFlag", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("starts at the default when nothing is saved", () => {
    const { result } = renderHook(() => usePersistedFlag(KEY, false));

    expect(result.current[0]).toBe(false);
  });

  it.each([
    ["true", true],
    ["false", false],
  ])("reads a saved %s", (saved, expected) => {
    localStorage.setItem(KEY, saved);

    const { result } = renderHook(() => usePersistedFlag(KEY, !expected));

    expect(result.current[0]).toBe(expected);
  });

  it("falls back to the default for a value that is neither true nor false", () => {
    localStorage.setItem(KEY, "yes");

    const { result } = renderHook(() => usePersistedFlag(KEY, true));

    expect(result.current[0]).toBe(true);
  });

  it("saves every change, so a new mount starts from it", () => {
    const { result, unmount } = renderHook(() => usePersistedFlag(KEY, false));

    act(() => result.current[1]((previous) => !previous));

    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem(KEY)).toBe("true");

    unmount();
    const { result: remounted } = renderHook(() =>
      usePersistedFlag(KEY, false),
    );

    expect(remounted.current[0]).toBe(true);
  });

  it("starts at the default and keeps working in memory when the storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    const { result } = renderHook(() => usePersistedFlag(KEY, false));

    expect(result.current[0]).toBe(false);

    act(() => result.current[1](true));

    expect(result.current[0]).toBe(true);
  });
});
