import { describe, expect, it } from "vitest";
import { render, screen, signIn } from "@/test";
import { DashboardSidebar } from "../DashboardSidebar";
import { Route, Routes } from "react-router";

function renderSidebarAt(route: string) {
  return render(
    <Routes>
      <Route path="*" element={<DashboardSidebar />} />
    </Routes>,
    { route }
  );
}

describe("DashboardSidebar", () => {
  it("renders user information and main navigation links", () => {
    signIn({ fullName: "Liriel Gomes", email: "liriel@ufal.br" });
    renderSidebarAt("/dashboard");

    expect(screen.getByText("Liriel Gomes")).toBeInTheDocument();
    expect(screen.getByText("liriel@ufal.br")).toBeInTheDocument();
    expect(screen.getByText("Total contribuído")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Home/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ações/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dados Pessoais/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Certificados/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Denúncias/i })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Ajuda/i })).toBeInTheDocument();
    
    // CORREÇÃO AQUI: Procurar pelo aria-label exato definido no botão
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("highlights the active tab based on the current route", () => {
    signIn();
    renderSidebarAt("/profile");

    const personalDataButton = screen.getByRole("button", { name: /Dados Pessoais/i });
    expect(personalDataButton).toHaveAttribute("aria-current", "page");
  });
});
