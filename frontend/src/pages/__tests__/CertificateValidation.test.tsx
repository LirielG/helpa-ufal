import { describe, expect, it } from "vitest";
import { useLocation, useNavigate } from "react-router";
import {
  API,
  delay,
  http,
  HttpResponse,
  makeCertificateValidation,
  render,
  screen,
  server,
  waitFor,
} from "@/test";
import { CertificateValidation } from "@/pages/CertificateValidation";

function LocationProbe() {
  const navigate = useNavigate();

  return (
    <>
      <p data-testid="location">{useLocation().pathname}</p>
      <button type="button" onClick={() => navigate(-1)}>
        history back
      </button>
    </>
  );
}

function renderPage(route: string) {
  return render(
    <>
      <CertificateValidation />
      <LocationProbe />
    </>,
    { route, path: "/validar/:validationCode?" },
  );
}

/** Records the code of every validation request, as the route received it. */
function recordRequests(
  respond: () => Response | Promise<Response> = () =>
    HttpResponse.json(makeCertificateValidation()),
) {
  const codes: string[] = [];

  server.use(
    http.get(`${API}/certificate-validations/:validationCode`, ({ params }) => {
      codes.push(String(params.validationCode));
      return respond();
    }),
  );

  return codes;
}

describe("CertificateValidation", () => {
  describe("code in the URL", () => {
    it("validates on mount and shows what the certificate attests", async () => {
      const codes = recordRequests();

      renderPage("/validar/7KQ4MX9T2R");

      expect(
        await screen.findByText("Certificado autêntico"),
      ).toBeInTheDocument();
      expect(screen.getByText("Maria Silva Souza")).toBeInTheDocument();
      expect(
        screen.getByText("Semana da Computação — Oficina de Git"),
      ).toBeInTheDocument();
      expect(screen.getByText("10/06/2026 a 12/06/2026")).toBeInTheDocument();
      expect(screen.getByText("8 horas")).toBeInTheDocument();
      expect(screen.getByText("15/06/2026")).toBeInTheDocument();
      expect(screen.getByText("7KQ4M-X9T2R")).toBeInTheDocument();
      expect(
        screen.getByText(
          /os dados exibidos são os vigentes e prevalecem sobre o documento impresso/i,
        ),
      ).toBeInTheDocument();
      expect(codes).toEqual(["7KQ4MX9T2R"]);
    });

    it("fills the field with the code from the URL", async () => {
      renderPage("/validar/7KQ4MX9T2R");

      expect(screen.getByLabelText("Código de validação")).toHaveValue(
        "7KQ4MX9T2R",
      );
      await screen.findByText("Certificado autêntico");
    });

    it("announces the result to screen readers", async () => {
      renderPage("/validar/7KQ4MX9T2R");

      const result = await screen.findByText("Certificado autêntico");

      expect(result.closest("[aria-live]")).toHaveAttribute(
        "aria-live",
        "polite",
      );
    });

    it("trims the code from the URL like a typed one", async () => {
      const codes = recordRequests();

      renderPage("/validar/%207KQ4MX9T2R%20");

      await screen.findByText("Certificado autêntico");
      expect(codes).toEqual(["7KQ4MX9T2R"]);
      expect(screen.getByLabelText("Código de validação")).toHaveValue(
        "7KQ4MX9T2R",
      );
    });

    it("never shows the previous code's answer after going back in history", async () => {
      const codes = recordRequests(async () => {
        await delay(50);
        return codes.length === 2
          ? HttpResponse.json(
              { status: 404, message: "Certificate not found." },
              { status: 404 },
            )
          : HttpResponse.json(makeCertificateValidation());
      });
      const { user } = renderPage("/validar/7KQ4MX9T2R");

      await screen.findByText("Certificado autêntico");

      const field = screen.getByLabelText("Código de validação");
      await user.clear(field);
      await user.type(field, "0000000000{Enter}");
      await screen.findByText("Código não encontrado");

      await user.click(screen.getByRole("button", { name: "history back" }));

      expect(screen.getByText("Consultando certificado…")).toBeInTheDocument();
      expect(screen.queryByText("Código não encontrado")).toBeNull();
      expect(
        await screen.findByText("Certificado autêntico"),
      ).toBeInTheDocument();
      expect(codes).toEqual(["7KQ4MX9T2R", "0000000000", "7KQ4MX9T2R"]);
    });

    it("shows nothing the API returns beyond the attested fields", async () => {
      recordRequests(() =>
        HttpResponse.json({
          ...makeCertificateValidation(),
          holderEmail: "maria@ufal.br",
          enrollmentId: "enrollment-secret",
        }),
      );

      renderPage("/validar/7KQ4MX9T2R");

      await screen.findByText("Certificado autêntico");
      expect(screen.queryByText("maria@ufal.br")).toBeNull();
      expect(screen.queryByText("enrollment-secret")).toBeNull();
    });
  });

  describe("unknown code", () => {
    it("explains the negative result without calling the document fake", async () => {
      recordRequests(() =>
        HttpResponse.json(
          { status: 404, message: "Certificate not found." },
          { status: 404 },
        ),
      );

      renderPage("/validar/0000000000");

      expect(
        await screen.findByText("Código não encontrado"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/confira se o código foi digitado/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/falso/i)).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Tentar novamente" }),
      ).toBeNull();
    });
  });

  describe("network failure", () => {
    it("shows a pt-BR message and validates again on retry", async () => {
      let fail = true;
      const codes = recordRequests(() =>
        fail
          ? HttpResponse.error()
          : HttpResponse.json(makeCertificateValidation()),
      );
      const { user } = renderPage("/validar/7KQ4MX9T2R");

      expect(
        await screen.findByText(/não foi possível consultar o certificado/i),
      ).toBeInTheDocument();

      fail = false;
      await user.click(
        screen.getByRole("button", { name: "Tentar novamente" }),
      );

      expect(
        await screen.findByText("Certificado autêntico"),
      ).toBeInTheDocument();
      expect(codes).toHaveLength(2);
    });
  });

  describe("form", () => {
    it("trims the typed code, sends the rest as typed and puts it in the URL", async () => {
      const codes = recordRequests();
      const { user } = renderPage("/validar");

      await user.type(
        screen.getByLabelText("Código de validação"),
        " 7kq4m-x9t2r {Enter}",
      );

      expect(
        await screen.findByText("Certificado autêntico"),
      ).toBeInTheDocument();
      expect(codes).toEqual(["7kq4m-x9t2r"]);
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/validar/7kq4m-x9t2r",
      );
    });

    it("sends no request when the field is empty", async () => {
      const codes = recordRequests();
      const { user } = renderPage("/validar");

      await user.type(screen.getByLabelText("Código de validação"), "   ");
      await user.click(screen.getByRole("button", { name: "Validar" }));

      expect(codes).toEqual([]);
      expect(screen.getByTestId("location")).toHaveTextContent(/^\/validar$/);
    });

    it("validates once on a double click", async () => {
      const codes = recordRequests(async () => {
        await delay(50);
        return HttpResponse.json(makeCertificateValidation());
      });
      const { user } = renderPage("/validar");

      await user.type(
        screen.getByLabelText("Código de validação"),
        "7KQ4MX9T2R",
      );
      await user.dblClick(screen.getByRole("button", { name: "Validar" }));

      await screen.findByText("Certificado autêntico");
      expect(codes).toHaveLength(1);
    });

    it("validates once on a double click over the code already in the URL", async () => {
      const codes = recordRequests(async () => {
        await delay(50);
        return HttpResponse.json(makeCertificateValidation());
      });
      const { user } = renderPage("/validar/7KQ4MX9T2R");

      await screen.findByText("Certificado autêntico");
      await user.dblClick(screen.getByRole("button", { name: "Validar" }));

      await screen.findByText("Certificado autêntico");
      expect(codes).toHaveLength(2);
    });

    it("validates again when the code already in the URL is submitted", async () => {
      const codes = recordRequests();
      const { user } = renderPage("/validar/7KQ4MX9T2R");

      await screen.findByText("Certificado autêntico");
      await user.click(screen.getByRole("button", { name: "Validar" }));

      await waitFor(() => expect(codes).toHaveLength(2));
    });
  });
});
