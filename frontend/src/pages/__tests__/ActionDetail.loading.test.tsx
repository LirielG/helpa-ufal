import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router";
import { render, screen } from "@/test/render";
import { API, http, HttpResponse, server } from "@/test/http";
import { makeActionDetail } from "@/test/factories";
import { useSessionExpiry } from "@/hooks/useSessionExpiry";
import { ActionDetail } from "../ActionDetail";

const ACTION_ID = "action-loading";
const CONNECTION_MESSAGE =
  "Não foi possível carregar a ação. Verifique sua conexão e tente novamente.";

function SessionExpiry() {
  useSessionExpiry();
  return null;
}

function renderDetail() {
  return render(
    <>
      <SessionExpiry />
      <Routes>
        <Route path="/activity/:id" element={<ActionDetail />} />
        <Route path="/login" element={<h1>Entrar</h1>} />
      </Routes>
    </>,
    { route: `/activity/${ACTION_ID}` },
  );
}

describe("ActionDetail loading failures", () => {
  it.each([0, 500])(
    "retries a loading failure (%s) and displays the loaded action",
    async (status) => {
      const action = makeActionDetail({ id: ACTION_ID });
      let calls = 0;
      server.use(
        http.get(`${API}/activities/${ACTION_ID}`, () => {
          calls += 1;
          if (calls > 1) return HttpResponse.json(action);
          return status === 0
            ? HttpResponse.error()
            : new HttpResponse(null, { status });
        }),
      );

      const { user } = renderDetail();

      expect(await screen.findByText(CONNECTION_MESSAGE)).toBeInTheDocument();
      expect(
        screen.queryByText("Ação não encontrada."),
      ).not.toBeInTheDocument();
      await user.click(
        screen.getByRole("button", { name: "Tentar novamente" }),
      );

      expect(
        await screen.findByRole("heading", { name: action.title }),
      ).toBeInTheDocument();
      expect(screen.queryByText(CONNECTION_MESSAGE)).not.toBeInTheDocument();
      expect(calls).toBe(2);
    },
  );
  it("shows loading during a retry and keeps retry available if it fails again", async () => {
    let calls = 0;
    let release!: () => void;
    const responseReady = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${API}/activities/${ACTION_ID}`, async () => {
        calls += 1;
        if (calls > 1) await responseReady;
        return HttpResponse.error();
      }),
    );
    const { user } = renderDetail();
    await user.click(
      await screen.findByRole("button", { name: "Tentar novamente" }),
    );
    expect(screen.getByText("Carregando...")).toBeInTheDocument();
    expect(screen.queryByText(CONNECTION_MESSAGE)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tentar novamente" }),
    ).not.toBeInTheDocument();
    release();
    expect(await screen.findByText(CONNECTION_MESSAGE)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tentar novamente" }),
    ).toBeEnabled();
    expect(calls).toBe(2);
  });

  it("shows not found without retry when a retry answers 404", async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/activities/${ACTION_ID}`, () => {
        calls += 1;
        return new HttpResponse(null, { status: calls === 1 ? 500 : 404 });
      }),
    );
    const { user } = renderDetail();
    await user.click(
      await screen.findByRole("button", { name: "Tentar novamente" }),
    );
    expect(await screen.findByText("Ação não encontrada.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tentar novamente" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Voltar/ })).toBeEnabled();
  });

  it("lets the session handler redirect to login on 401", async () => {
    server.use(
      http.get(
        `${API}/activities/${ACTION_ID}`,
        () => new HttpResponse(null, { status: 401 }),
      ),
    );
    renderDetail();
    expect(
      await screen.findByRole("heading", { name: "Entrar" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(CONNECTION_MESSAGE)).not.toBeInTheDocument();
  });
});
