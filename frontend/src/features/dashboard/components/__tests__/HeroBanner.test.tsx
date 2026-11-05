import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  render,
  screen,
  within,
  API,
  http,
  HttpResponse,
  server,
  waitFor,
} from "@/test";
import { HeroBanner } from "../HeroBanner";
import type { ActivityListItem } from "@/services/contracts/activity";

const mockActions = [
  { id: "1", title: "Slide 1", startDate: "2026-05-09T12:00:00Z" },
  { id: "2", title: "Slide 2", startDate: "2026-05-10T12:00:00Z" },
  { id: "3", title: "Slide 3", startDate: "2026-05-11T12:00:00Z" },
  { id: "4", title: "Slide 4", startDate: "2026-05-12T12:00:00Z" },
] as unknown as ActivityListItem[];

function setupFeaturedServer(activities = mockActions) {
  server.use(
    http.get(`${API}/activities`, ({ request }) => {
      const url = new URL(request.url);
      const status = url.searchParams.get("status");
      const limit = url.searchParams.get("limit");

      if (status === "OPEN" && limit === "4") {
        return HttpResponse.json({
          activities,
          total: activities.length,
        });
      }

      return HttpResponse.json({ activities: [], total: 0 });
    }),
  );
}

async function getVisibleSlideTitle(): Promise<string> {
  const heading = await screen.findByRole("heading");
  return heading.textContent || "";
}

describe("HeroBanner", () => {
  beforeEach(() => {
    setupFeaturedServer();
  });

  it("shows the first slide on mount", async () => {
    render(<HeroBanner />);
    expect(await getVisibleSlideTitle()).toBe("Slide 1");
  });

  it("moves to the next slide", async () => {
    const { user } = render(<HeroBanner />);
    await screen.findByRole("heading");
    await user.click(screen.getByRole("button", { name: "Próximo slide" }));
    expect(await getVisibleSlideTitle()).toBe("Slide 2");
  });

  it("wraps around to the last slide when going back from the first", async () => {
    const { user } = render(<HeroBanner />);
    await screen.findByRole("heading");
    await user.click(screen.getByRole("button", { name: "Slide anterior" }));
    expect(await getVisibleSlideTitle()).toBe("Slide 4");
  });

  it("wraps around to the first slide when advancing past the last", async () => {
    const { user } = render(<HeroBanner />);
    await screen.findByRole("heading");
    for (let click = 0; click < 4; click += 1) {
      await user.click(screen.getByRole("button", { name: "Próximo slide" }));
    }
    expect(await getVisibleSlideTitle()).toBe("Slide 1");
  });

  it("jumps to the slide picked from the dots and marks it as current", async () => {
    const { user } = render(<HeroBanner />);
    await screen.findByRole("heading");
    await user.click(screen.getByRole("button", { name: "Ir para slide 3" }));

    expect(await getVisibleSlideTitle()).toBe("Slide 3");
    expect(
      screen.getByRole("button", { name: "Ir para slide 3" }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("links 'Saiba mais' to the detail screen of the slide currently visible", async () => {
    const { user } = render(<HeroBanner />);
    await screen.findByRole("heading");

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
  it("does not render when there are no OPEN actions available", async () => {
    setupFeaturedServer([]);
    render(<HeroBanner />);

    await waitFor(() => {
      expect(screen.queryByTestId("hero-slide")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    });
  });

  it("does not render when the request fails with error", async () => {
    server.use(
      http.get(
        `${API}/activities`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    render(<HeroBanner />);

    await waitFor(() => {
      expect(screen.queryByTestId("hero-slide")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    });
  });

  describe("automatic rotation", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("advances on its own every five seconds", async () => {
      render(<HeroBanner />);

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByRole("heading").textContent).toBe("Slide 2");

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByRole("heading").textContent).toBe("Slide 3");
    });

    it("stops rotating once it leaves the screen", async () => {
      const { unmount } = render(<HeroBanner />);
      await act(async () => {
        await Promise.resolve();
      });
      unmount();
      expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  // jsdom does not implement `inert` behaviour, so these tests only assert the
  // attribute; tab order and click targeting must be checked in a real browser.
  describe("hidden slides leave the tab order and the click area", () => {
    it("puts inert on the hidden slides only", async () => {
      render(<HeroBanner />);
      await screen.findByRole("heading");

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

    it("keeps the control of every hidden slide inside an inert container", async () => {
      render(<HeroBanner />);
      await screen.findByRole("heading");

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
      const { user } = render(<HeroBanner />);
      await screen.findByRole("heading");
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
