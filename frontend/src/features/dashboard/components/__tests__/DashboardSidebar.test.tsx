import { describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router";
import { render, screen, signIn, within } from "@/test";
import { DashboardSidebar } from "../DashboardSidebar";

function renderSidebarAt(
  route: string,
  props: React.ComponentProps<typeof DashboardSidebar> = {},
) {
  return render(
    <Routes>
      <Route path="*" element={<DashboardSidebar {...props} />} />
    </Routes>,
    { route },
  );
}

describe("DashboardSidebar", () => {
  it("renders user information and main navigation links", () => {
    const user = signIn({ fullName: "Liriel Gomes", email: "liriel@ufal.br" });
    renderSidebarAt("/dashboard", {
      profile: {
        ...user,
        registrationCode: "2026000001",
        course: "Ciência da Computação",
        cndb: null,
        totalWorkloadHours: 48,
      },
    });

    expect(screen.getByText("Liriel Gomes")).toBeInTheDocument();
    expect(screen.getByText("liriel@ufal.br")).toBeInTheDocument();
    expect(screen.getByText("Ciência da Computação")).toBeInTheDocument();
    expect(screen.getByText("Total contribuído")).toBeInTheDocument();
    expect(screen.getByText("48 horas")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Home/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ações/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Atividades Inscritas/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Atividades Concluídas/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Atividades Gerenciadas/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Dados Pessoais/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Certificados/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Denúncias/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ajuda/i })).toBeInTheDocument();

    // Match the exact aria-label defined on the logout button.
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("omits course and workload hours when profile data is not loaded yet", () => {
    signIn({ fullName: "Liriel Gomes", email: "liriel@ufal.br" });
    renderSidebarAt("/dashboard", { profile: null });

    expect(screen.getByText("Liriel Gomes")).toBeInTheDocument();
    expect(screen.queryByText("Ciência da Computação")).not.toBeInTheDocument();
    expect(screen.queryByText("Total contribuído")).not.toBeInTheDocument();
  });

  it("highlights the active tab based on the current route", () => {
    signIn();
    renderSidebarAt("/profile");

    const personalDataButton = screen.getByRole("button", {
      name: /Dados Pessoais/i,
    });
    expect(personalDataButton).toHaveAttribute("aria-current", "page");
  });

  it("shows Denúncias to a manager and navigates to /moderation", async () => {
    signIn({ isManager: true });
    const { user } = render(
      <Routes>
        <Route path="/moderation" element={<h1>Moderação</h1>} />
        <Route path="*" element={<DashboardSidebar />} />
      </Routes>,
      { route: "/dashboard" },
    );

    await user.click(screen.getByRole("button", { name: /Denúncias/i }));

    expect(
      screen.getByRole("heading", { name: "Moderação" }),
    ).toBeInTheDocument();
  });

  it("highlights Denúncias on the moderation route", () => {
    signIn({ isManager: true });
    renderSidebarAt("/moderation");

    expect(screen.getByRole("button", { name: /Denúncias/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("links the avatar and name block to /profile", async () => {
    signIn({ fullName: "Liriel Gomes", email: "liriel@ufal.br" });
    const { user } = render(
      <Routes>
        <Route path="/profile" element={<h1>Perfil</h1>} />
        <Route path="*" element={<DashboardSidebar />} />
      </Routes>,
      { route: "/dashboard" },
    );

    const link = screen.getByRole("link", { name: "Abrir meu perfil" });
    expect(link).toHaveAttribute("href", "/profile");

    await user.click(link);

    expect(screen.getByRole("heading", { name: "Perfil" })).toBeInTheDocument();
  });

  it("opens the profile link with the keyboard", async () => {
    signIn();
    const { user } = render(
      <Routes>
        <Route path="/profile" element={<h1>Perfil</h1>} />
        <Route path="*" element={<DashboardSidebar />} />
      </Routes>,
      { route: "/dashboard" },
    );

    screen.getByRole("link", { name: "Abrir meu perfil" }).focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("heading", { name: "Perfil" })).toBeInTheDocument();
  });

  it("closes the mobile sidebar when the profile link is clicked", async () => {
    signIn();
    const onCloseMobile = vi.fn();
    const { user } = renderSidebarAt("/dashboard", {
      isOpenMobile: true,
      onCloseMobile,
    });

    const drawer = screen.getByRole("dialog");
    await user.click(
      within(drawer).getByRole("link", { name: "Abrir meu perfil" }),
    );

    expect(onCloseMobile).toHaveBeenCalledTimes(1);
  });
});

