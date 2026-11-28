import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNavigate } from "react-router";
import { act, render, screen } from "@/test";
import { ScrollToTop } from "../ScrollToTop";

let navigate: ReturnType<typeof useNavigate>;

function NavigateProbe() {
  const navigateFromHook = useNavigate();
  useEffect(() => {
    navigate = navigateFromHook;
  }, [navigateFromHook]);
  return null;
}

function renderAt(route: string) {
  render(
    <>
      <ScrollToTop />
      <NavigateProbe />
      <span>page</span>
    </>,
    { route },
  );
  expect(screen.getByText("page")).toBeInTheDocument();
}

async function go(to: string | number, options?: { replace?: boolean }) {
  await act(async () => {
    await (typeof to === "number" ? navigate(to) : navigate(to, options));
  });
}

describe("ScrollToTop", () => {
  let scrollTo: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    scrollTo.mockRestore();
  });

  it("does not scroll when the app first loads", () => {
    renderAt("/dashboard");

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls to the top when a link opens another pathname", async () => {
    renderAt("/dashboard");

    await go("/activity/1");

    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(0, 0);
  });

  it("scrolls to the top when a replace navigation opens another pathname", async () => {
    renderAt("/dashboard");

    await go("/profile", { replace: true });

    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(0, 0);
  });

  it("keeps the scroll when only the query changes", async () => {
    renderAt("/dashboard?page=1");

    await go("/dashboard?page=2");
    await go("/dashboard?page=2&type=EVENT");

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls to the top when the sidebar switches to another list", async () => {
    renderAt("/my-activities?filter=enrolled");

    await go("/my-activities?filter=managed", { replace: true });

    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(0, 0);
  });

  it("leaves Back and Forward to the browser", async () => {
    renderAt("/dashboard");
    await go("/activity/1");
    scrollTo.mockClear();

    await go(-1);

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
