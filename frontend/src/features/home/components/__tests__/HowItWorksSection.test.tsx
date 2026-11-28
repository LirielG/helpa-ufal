import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test";
import { HowItWorksSection } from "../HowItWorksSection";
import {
  HELPA_JOURNEY_STEPS,
  HELPA_JOURNEY_TITLE,
} from "../../constants/howItWorks";

describe("HowItWorksSection", () => {
  it("explains the 5-step Helpa journey from enrollment through homologation to download", () => {
    render(<HowItWorksSection />);

    expect(
      screen.getByRole("heading", { name: HELPA_JOURNEY_TITLE }),
    ).toBeInTheDocument();

    for (const step of HELPA_JOURNEY_STEPS) {
      expect(
        screen.getByRole("heading", { name: step.title }),
      ).toBeInTheDocument();
      expect(screen.getByText(step.description)).toBeInTheDocument();
    }
  });

  it("explains homologated hours, automatic generation, and avoids legacy promises", () => {
    render(<HowItWorksSection />);

    expect(
      screen.getByText(/apenas se inscrever ou concluir a ação não gera certificado/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /horas homologadas pelo criador ou gestor, que podem ser diferentes da carga horária prevista/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /não é necessário solicitar a emissão nem aguardar processamento posterior após a homologação/i,
      ),
    ).toBeInTheDocument();

    expect(screen.queryByText(/feedback do coordenador/i)).toBeNull();
    expect(screen.queryByText(/emita seu comprovante/i)).toBeNull();
  });

  it("differentiates holder download from public validation and SIGAA external flow", () => {
    render(<HowItWorksSection />);

    expect(screen.getByText("Meus certificados")).toBeInTheDocument();
    expect(screen.getByText("Atividades Concluídas")).toBeInTheDocument();

    const validateLink = screen.getByRole("link", {
      name: /validar certificado/i,
    });
    expect(validateLink).toHaveAttribute("href", "/validate");

    expect(
      screen.getByText(
        /a jornada de certificados do helpa não se aplica às ações do sigaa/i,
      ),
    ).toBeInTheDocument();
  });

  it("calls onExploreActions when clicking the feed CTA", async () => {
    const onExploreActions = vi.fn();
    const { user } = render(
      <HowItWorksSection onExploreActions={onExploreActions} />,
    );

    await user.click(
      screen.getByRole("button", { name: /ir para o feed de ações/i }),
    );

    expect(onExploreActions).toHaveBeenCalledTimes(1);
  });
});
