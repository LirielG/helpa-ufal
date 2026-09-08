import { describe, expect, it } from "vitest";
import { render, screen } from "@/test";
import { http, HttpResponse } from "msw";
import { server } from "@/test"; 
import { Dashboard } from "../Dashboard";

const mockApiActivities = {
  activities: [
    {
      id: "1",
      title: "Oficina de React",
      type: "COURSE",
      status: "OPEN",
      availableSlots: 10,
      slots: 30,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      details: {
        description: "Aprenda React na prática.",
        workloadHours: 4,
        format: "Presencial"
      }
    }
  ],
  meta: { total: 1, page: 1, limit: 20 }
};

describe("Dashboard", () => {
  it("shows the loading state and then the list of actions", async () => {
    server.use(
      http.get("*/activities", () => {
        return HttpResponse.json(mockApiActivities);
      })
    );

    render(<Dashboard />);

    expect(screen.getByText("Buscando ações...")).toBeInTheDocument();

  const actionTitles = await screen.findAllByRole("heading", { name: "Oficina de React" });
  expect(actionTitles[0]).toBeInTheDocument();
  });

  it("shows the empty state when the API returns no actions", async () => {
    server.use(
      http.get("*/activities", () => {
        return HttpResponse.json({ activities: [], meta: { total: 0, page: 1, limit: 20 } });
      })
    );

    render(<Dashboard />);

    const emptyMessage = await screen.findByText("Nenhuma ação encontrada com esses filtros.");
    expect(emptyMessage).toBeInTheDocument();
  });

  it("shows the error banner when the request fails", async () => {
    server.use(
      http.get("*/activities", () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    render(<Dashboard />);

    const errorMessage = await screen.findByText("Não foi possível carregar as ações. Tente novamente.");
    expect(errorMessage).toBeInTheDocument();
  });

  it("opens the action creation form from the header", async () => {
    server.use(
      http.get("*/activities", () => HttpResponse.json(mockApiActivities))
    );
    
    const { user } = render(<Dashboard />);

    expect(screen.queryByText("Vamos criar uma ação?")).toBeNull();

    const createBtn = await screen.findByRole("button", { name: "Criar uma ação" });
    await user.click(createBtn);

    expect(screen.getByText("Vamos criar uma ação?")).toBeInTheDocument();
  });
});
