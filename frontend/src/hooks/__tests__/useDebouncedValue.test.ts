import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "../useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value right away", () => {
    const { result } = renderHook(() => useDebouncedValue("abc", 400));

    expect(result.current).toBe("abc");
  });

  it("holds the previous value until the delay elapses", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 400),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "ab" });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("ab");
  });

  it("restarts the delay on every change, so typing settles only once", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 400),
      { initialProps: { value: "s" } },
    );

    rerender({ value: "su" });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    rerender({ value: "sus" });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe("s");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("sus");
  });
});
