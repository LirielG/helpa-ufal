import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@/test";
import { HeroBanner } from "../HeroBanner";
import type { Action } from "../../types";

const mockActions = [
  { id: "1", title: "Slide 1", startDate: "2026-05-09T12:00:00Z" },
  { id: "2", title: "Slide 2", startDate: "2026-05-10T12:00:00Z" },
  { id: "3", title: "Slide 3", startDate: "2026-05-11T12:00:00Z" },
  { id: "4", title: "Slide 4", startDate: "2026-05-12T12:00:00Z" },
] as unknown as Action[];

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
    expect(
      screen.getByRole("button", { name: "Ir para slide 3" }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("links 'Saiba mais' to the detail screen of the slide currently visible", async () => {
    const { user } = render(<HeroBanner actions={mockActions} />);

    expect(screen.getByRole("link", { name: "Saiba mais" })).toHaveAttribute(
      "href",
      "/activity/1",
    );

    await user.click(screen.getByRole("button", { name: "Próximo slide" }));

    expect(screen.getByRole("link", { name: "Saiba mais" })).toHaveAttribute(
      "href",
      "/activity/2",
    );
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

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(getVisibleSlideTitle()).toBe("Slide 2");

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(getVisibleSlideTitle()).toBe("Slide 3");
    });

    it("stops rotating once it leaves the screen", () => {
      const { unmount } = render(<HeroBanner actions={mockActions} />);
      unmount();
      expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  // jsdom does not implement `inert`, so these assertions cover the attribute
  // that enforces the behaviour in a real browser. Tab order and click
  // targeting are not verifiable here and are checked manually — see the
  // manual test steps in the PR description.
  describe("hidden slides leave the tab order and the click area (#218)", () => {
    it("puts inert on the hidden slides only", () => {
      render(<HeroBanner actions={mockActions} />);

      const slides = screen.getAllByTestId("hero-slide");
      expect(slides).toHaveLength(4);

      const hidden = slides.filter((slide) => slide.hasAttribute("inert"));
      const visible = slides.filter((slide) => !slide.hasAttribute("inert"));

      expect(hidden).toHaveLength(3);
      expect(visible).toHaveLength(1);
      expect(visible[0]).not.toHaveAttribute("inert");
      expect(
        within(visible[0]).getByRole("link", { name: "Saiba mais" }),
      ).toHaveAttribute("href", "/activity/1");
    });

    it("keeps the control of every hidden slide inside an inert container", () => {
      render(<HeroBanner actions={mockActions} />);

      const links = screen.getAllByRole("link", {
        name: "Saiba mais",
        hidden: true,
      });
      expect(links).toHaveLength(4);

      const reachable = links.filter((link) => !link.closest("[inert]"));
      expect(reachable).toHaveLength(1);
      expect(reachable[0]).toHaveAttribute("href", "/activity/1");
    });

    it("moves inert to the slide that becomes visible when advancing", async () => {
      const { user } = render(<HeroBanner actions={mockActions} />);
      await user.click(screen.getByRole("button", { name: "Próximo slide" }));

      const slides = screen.getAllByTestId("hero-slide");
      const visible = slides.filter((slide) => !slide.hasAttribute("inert"));

      expect(visible).toHaveLength(1);
      expect(
        slides.filter((slide) => slide.hasAttribute("inert")),
      ).toHaveLength(3);
      expect(
        within(visible[0]).getByRole("link", { name: "Saiba mais" }),
      ).toHaveAttribute("href", "/activity/2");
    });
  });
});
