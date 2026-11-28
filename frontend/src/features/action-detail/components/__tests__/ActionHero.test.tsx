import { describe, expect, it } from "vitest";
import { Link, Route, Routes } from "react-router";
import { render, screen } from "@/test";
import { ActionHero } from "../ActionHero";

describe("ActionHero", () => {
  it("renders bounded hero height with cover, back link to the left of the category tag, and title", async () => {
    const { container, user } = render(
      <Routes>
        <Route
          path="/activity/action-1"
          element={
            <ActionHero
              actionId="action-1"
              type="COURSE"
              category="Tecnologia"
              title="Oficina de Programação"
            />
          }
        />
        <Route path="/dashboard" element={<h1>Dashboard</h1>} />
      </Routes>,
      { route: "/activity/action-1" },
    );

    expect(container.firstElementChild).toHaveClass(
      "min-h-[clamp(16rem,35vh,24rem)]",
    );
    expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();

    const backLink = screen.getByRole("link", { name: "← Voltar" });
    const categoryTag = screen.getByText("Tecnologia");

    expect(backLink).toBeInTheDocument();
    expect(categoryTag).toBeInTheDocument();
    // BackLink sits immediately to the left of the category tag on the same row.
    expect(
      backLink.compareDocumentPosition(categoryTag) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(
      screen.getByRole("heading", { level: 1, name: "Oficina de Programação" }),
    ).toBeInTheDocument();

    await user.click(backLink);
    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
  });

  it("returns to the previous page when navigated internally", async () => {
    const { user } = render(
      <Routes>
        <Route
          path="/my-activities"
          element={<Link to="/activity/action-1">Ver ação</Link>}
        />
        <Route
          path="/activity/action-1"
          element={
            <ActionHero
              actionId="action-1"
              type="COURSE"
              category="Tecnologia"
              title="Oficina de Programação"
            />
          }
        />
        <Route path="/dashboard" element={<h1>Dashboard</h1>} />
      </Routes>,
      { route: "/my-activities" },
    );

    await user.click(screen.getByRole("link", { name: "Ver ação" }));
    await user.click(screen.getByRole("link", { name: "← Voltar" }));

    expect(screen.getByRole("link", { name: "Ver ação" })).toBeInTheDocument();
  });
});
