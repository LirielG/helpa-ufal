import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router";
import { render, screen, signIn } from "@/test";
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
      screen.getByRole("button", { name: /Denúncias/i }),
    ).toBeInTheDocument();
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
});
