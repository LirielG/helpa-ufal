import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@/test";
import { HeroBanner } from "../HeroBanner";

/** Slide titles, in carousel order. They are UI copy, kept literal on purpose. */
const SLIDE_TITLES = [
  "Oficina de Programação",
  "Aulas de Reforço Escolar",
  "Ação Ambiental",
  "Saúde na Comunidade",
];

/** The title of the slide currently exposed to the user. */
function getVisibleSlideTitle(): string {
  const visible = SLIDE_TITLES.filter(
    (title) => screen.queryByRole("heading", { name: title }) !== null,
  );

  expect(visible).toHaveLength(1);
  return visible[0];
}

describe("HeroBanner", () => {
  it("shows the first slide on mount", () => {
    render(<HeroBanner />);

    expect(getVisibleSlideTitle()).toBe(SLIDE_TITLES[0]);
  });

  it("moves to the next slide", async () => {
    const { user } = render(<HeroBanner />);

    await user.click(screen.getByRole("button", { name: "Próximo slide" }));

    expect(getVisibleSlideTitle()).toBe(SLIDE_TITLES[1]);
  });

  it("wraps around to the last slide when going back from the first", async () => {
    const { user } = render(<HeroBanner />);

    await user.click(screen.getByRole("button", { name: "Slide anterior" }));

    expect(getVisibleSlideTitle()).toBe(SLIDE_TITLES.at(-1));
  });

  it("wraps around to the first slide when advancing past the last", async () => {
    const { user } = render(<HeroBanner />);

    for (let click = 0; click < SLIDE_TITLES.length; click += 1) {
      await user.click(screen.getByRole("button", { name: "Próximo slide" }));
    }

    expect(getVisibleSlideTitle()).toBe(SLIDE_TITLES[0]);
  });

  it("jumps to the slide picked from the dots and marks it as current", async () => {
    const { user } = render(<HeroBanner />);

    await user.click(screen.getByRole("button", { name: "Ir para slide 3" }));

    expect(getVisibleSlideTitle()).toBe(SLIDE_TITLES[2]);
    expect(
      screen.getByRole("button", { name: "Ir para slide 3" }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("button", { name: "Ir para slide 1" }),
    ).not.toHaveAttribute("aria-current", "true");
  });

  // Fake timers are scoped to this test: the ones above rely on userEvent,
  // which needs the real clock to settle its interactions.
  describe("automatic rotation", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("advances on its own every five seconds", () => {
      render(<HeroBanner />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(getVisibleSlideTitle()).toBe(SLIDE_TITLES[1]);

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(getVisibleSlideTitle()).toBe(SLIDE_TITLES[2]);
    });

    it("stops rotating once it leaves the screen", () => {
      const { unmount } = render(<HeroBanner />);

      unmount();

      expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
