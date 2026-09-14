import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@/test";
import { HeroBanner } from "../HeroBanner";
import type { Action } from "../../types";

const mockActions = [
  { id: "1", title: "Slide 1", startDate: "2026-05-09T12:00:00Z" },
  { id: "2", title: "Slide 2", startDate: "2026-05-10T12:00:00Z" },
  { id: "3", title: "Slide 3", startDate: "2026-05-11T12:00:00Z" },
  { id: "4", title: "Slide 4", startDate: "2026-05-12T12:00:00Z" },
] as unknown as Action[]

function getVisibleSlideTitle(): string {
  return screen.getByRole("heading").textContent || "";
}

describe("HeroBanner", () => {
  it("shows the first slide on mount", () => {
    render(<HeroBanner actions={mockActions} />);
    expect(getVisibleSlideTitle()).toBe("Slide 1");
  });

  it("moves to the next slide", async () => {
    const { user } = render(<HeroBanner actions={mockActions} />);
    await user.click(screen.getByRole("button", { name: "Próximo slide" }));
    expect(getVisibleSlideTitle()).toBe("Slide 2");
  });

  it("wraps around to the last slide when going back from the first", async () => {
    const { user } = render(<HeroBanner actions={mockActions} />);
    await user.click(screen.getByRole("button", { name: "Slide anterior" }));
    expect(getVisibleSlideTitle()).toBe("Slide 4");
  });

  it("wraps around to the first slide when advancing past the last", async () => {
    const { user } = render(<HeroBanner actions={mockActions} />);
    for (let click = 0; click < 4; click += 1) {
      await user.click(screen.getByRole("button", { name: "Próximo slide" }));
    }
    expect(getVisibleSlideTitle()).toBe("Slide 1");
  });

  it("jumps to the slide picked from the dots and marks it as current", async () => {
    const { user } = render(<HeroBanner actions={mockActions} />);
    await user.click(screen.getByRole("button", { name: "Ir para slide 3" }));
    
    expect(getVisibleSlideTitle()).toBe("Slide 3");
    expect(screen.getByRole("button", { name: "Ir para slide 3" })).toHaveAttribute("aria-current", "true");
  });

  describe("automatic rotation", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("advances on its own every five seconds", () => {
      render(<HeroBanner actions={mockActions} />);

      act(() => { vi.advanceTimersByTime(5000); });
      expect(getVisibleSlideTitle()).toBe("Slide 2");

      act(() => { vi.advanceTimersByTime(5000); });
      expect(getVisibleSlideTitle()).toBe("Slide 3");
    });

    it("stops rotating once it leaves the screen", () => {
      const { unmount } = render(<HeroBanner actions={mockActions} />);
      unmount();
      expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
