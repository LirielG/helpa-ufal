import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/test/render";
import { API, http, HttpResponse, server } from "@/test/http";
import { makeActionDetail } from "@/test/factories";
import { ActionDetail } from "../ActionDetail";
import { ACTION_CAMPUS_LABELS } from "@/features/dashboard/constants";
import type { CampusLocation } from "@/services/contracts/activity";

const ACTION_ID = "action-info";

function renderDetail() {
  return render(<ActionDetail />, {
    route: `/activity/${ACTION_ID}`,
    path: "/activity/:id",
  });
}

describe("ActionDetail information", () => {
  it("shows the city, state and street for an in-person action", async () => {
    const action = makeActionDetail({ id: ACTION_ID });
    server.use(
      http.get(`${API}/activities/${ACTION_ID}`, () =>
        HttpResponse.json(action),
      ),
    );

    renderDetail();

    await screen.findByRole("heading", { name: "Informações" });
    const location = screen
      .getAllByRole("listitem")
      .find((item) => within(item).queryByText("Local / Formato"))!;
    expect(within(location).getByText("Arapiraca - AL")).toBeInTheDocument();
    expect(
      within(location).getByText("Av. Manoel Severino Barbosa, s/n"),
    ).toBeInTheDocument();
  });

  it("shows the online format without an address placeholder", async () => {
    const action = makeActionDetail({ id: ACTION_ID });
    server.use(
      http.get(`${API}/activities/${ACTION_ID}`, () =>
        HttpResponse.json({
          ...action,
          details: { ...action.details, format: "ONLINE", address: null },
        }),
      ),
    );

    renderDetail();

    expect(await screen.findByText("On-line")).toBeInTheDocument();
    expect(
      screen.queryByText("Endereço não informado"),
    ).not.toBeInTheDocument();
  });

  it.each(Object.entries(ACTION_CAMPUS_LABELS))(
    "shows the label for campus %s instead of its enum",
    async (campus, label) => {
      server.use(
        http.get(`${API}/activities/${ACTION_ID}`, () =>
          HttpResponse.json(
            makeActionDetail({
              id: ACTION_ID,
              campus: campus as CampusLocation,
            }),
          ),
        ),
      );

      renderDetail();

      expect(await screen.findByText(label)).toBeInTheDocument();
      expect(
        screen.queryByText(campus, { exact: true }),
      ).not.toBeInTheDocument();
    },
  );

  it("shows the API period, local times and workload", async () => {
    const action = makeActionDetail({
      id: ACTION_ID,
      startDate: "2026-11-03T12:30:00.000Z",
      endDate: "2026-11-05T18:45:00.000Z",
    });
    server.use(
      http.get(`${API}/activities/${ACTION_ID}`, () =>
        HttpResponse.json({
          ...action,
          details: { ...action.details, workloadHours: 13 },
        }),
      ),
    );

    renderDetail();

    expect(
      await screen.findByText("03/11/2026 a 05/11/2026"),
    ).toBeInTheDocument();
    expect(screen.getByText("09:30 às 15:45")).toBeInTheDocument();
    expect(screen.getByText("13 horas")).toBeInTheDocument();
  });

  it("shows loading until the activity response arrives", async () => {
    let release!: () => void;
    const responseReady = new Promise<void>((resolve) => {
      release = resolve;
    });
    const action = makeActionDetail({ id: ACTION_ID });
    server.use(
      http.get(`${API}/activities/${ACTION_ID}`, async () => {
        await responseReady;
        return HttpResponse.json(action);
      }),
    );

    renderDetail();

    expect(screen.getByText("Carregando...")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: action.title }),
    ).not.toBeInTheDocument();
    release();
    expect(
      await screen.findByRole("heading", { name: action.title }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Carregando...")).not.toBeInTheDocument();
  });

  it("shows a not-found message and a back button on 404", async () => {
    server.use(
      http.get(
        `${API}/activities/${ACTION_ID}`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    renderDetail();

    expect(await screen.findByText("Ação não encontrada.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Voltar/ })).toBeInTheDocument();
    expect(screen.queryByText("Carregando...")).not.toBeInTheDocument();
  });
});
