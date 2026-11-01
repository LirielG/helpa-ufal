import { describe, expect, it } from "vitest";
import { render, screen } from "@/test";
import { FeedSection } from "../FeedSection";
import { Route, Routes } from "react-router";

describe("FeedSection", () => {
  it("renders the FeedTabs and the default Helpa feed", async () => {
    render(
      <Routes>
        <Route path="/dashboard" element={<FeedSection debounceMs={0} />} />
      </Routes>,
      { route: "/dashboard" }
    );

    // Verifica se as tabs de Helpa e SIGAA estão presentes 
    // O role correto para elas no DOM é "tab"
    expect(screen.getByRole("tab", { name: /Helpa/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /SIGAA/i })).toBeInTheDocument();

    // Verifica se a barra de pesquisa do HelpaFeed carregou
    expect(screen.getByPlaceholderText(/Buscar ações pelo título/i)).toBeInTheDocument();
  });
});
