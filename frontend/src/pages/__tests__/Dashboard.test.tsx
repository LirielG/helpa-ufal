import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@/test";
import { http, HttpResponse } from "msw";
import { API, server } from "@/test";
import { Dashboard } from "../Dashboard";

const SEARCH_FIELD = "Buscar ações pelo título";

const SEARCH_DEBOUNCE_MS = 200;

/** debounceMs 0 keeps fake timers out of the page tests. */
function renderDashboard(debounceMs = 0) {
  return render(<Dashboard debounceMs={debounceMs} />);
}

/**
 * Fills the search field in a single edit. Typing character by character would
 * fire a request per prefix and put the feed back into its loading state
 * between each of them, leaving assertions racing the renders. The debounce is
 * covered by its own test below and by useDebouncedValue.test.ts.
 */
async function search(
  user: ReturnType<typeof render>["user"],
  term: string,
): Promise<void> {
  await user.click(screen.getByRole("searchbox", { name: SEARCH_FIELD }));
  await user.paste(term);
}

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
        format: "Presencial",
      },
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

describe("Dashboard", () => {
  it("shows the loading state and then the list of actions", async () => {
    server.use(
      http.get("*/activities", () => {
        return HttpResponse.json(mockApiActivities);
      }),
    );

    render(<Dashboard />);

    expect(screen.getByText("Buscando ações...")).toBeInTheDocument();

    const actionTitles = await screen.findAllByRole("heading", {
      name: "Oficina de React",
    });
    expect(actionTitles[0]).toBeInTheDocument();
  });

  it("shows the empty state when the API returns no actions", async () => {
    server.use(
      http.get("*/activities", () => {
        return HttpResponse.json({
          activities: [],
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        });
      }),
    );

    render(<Dashboard />);

    const emptyMessage = await screen.findByText(
      "Nenhuma ação encontrada com esses filtros.",
    );
    expect(emptyMessage).toBeInTheDocument();
  });

  it("shows the error banner when the request fails", async () => {
    server.use(
      http.get("*/activities", () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    render(<Dashboard />);

    const errorMessage = await screen.findByText(
      "Não foi possível carregar as ações. Tente novamente.",
    );
    expect(errorMessage).toBeInTheDocument();
  });

  it("opens the action creation form from the header", async () => {
    server.use(
      http.get("*/activities", () => HttpResponse.json(mockApiActivities)),
    );

    const { user } = render(<Dashboard />);

    expect(screen.queryByText("Vamos criar uma ação?")).toBeNull();

    const createBtn = await screen.findByRole("button", {
      name: "Criar uma ação",
    });
    await user.click(createBtn);

    expect(screen.getByText("Vamos criar uma ação?")).toBeInTheDocument();
  });

  it("switches between the Helpa and SIGAA feeds", async () => {
    server.use(
      http.get("*/activities", () => HttpResponse.json(mockApiActivities)),
    );

    const { user } = render(<Dashboard />);

    await screen.findAllByRole("heading", { name: "Oficina de React" });
    expect(screen.getByRole("searchbox", { name: SEARCH_FIELD })).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "SIGAA" }));

    expect(
      await screen.findByRole("heading", {
        name: "I Ciclo de Debates sobre Currículos",
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", { level: 3, name: "Oficina de React" }),
    ).not.toBeInTheDocument();

    // Each tab owns one search box, so switching never leaves two on screen.
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    expect(
      screen.queryByRole("searchbox", { name: SEARCH_FIELD }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Helpa" }));

    const backToHelpa = await screen.findAllByRole("heading", {
      name: "Oficina de React",
    });
    expect(backToHelpa[0]).toBeInTheDocument();
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
  });

  it("sends the term as `search` and lists only the titles it matched", async () => {
    const searches: (string | null)[] = [];
    const catalogue = [
      mockApiActivities.activities[0],
      {
        ...mockApiActivities.activities[0],
        id: "2",
        title: "Palestra de Dados",
      },
    ];

    server.use(
      http.get("*/activities", ({ request }) => {
        const term = new URL(request.url).searchParams.get("search");
        searches.push(term);

        // Mirrors GET /activities: `contains` on the title, case-insensitive.
        const matched = term
          ? catalogue.filter((activity) =>
              activity.title.toLowerCase().includes(term.toLowerCase()),
            )
          : catalogue;

        return HttpResponse.json({
          ...mockApiActivities,
          activities: matched,
          total: matched.length,
        });
      }),
    );

    const { user } = renderDashboard();

    await screen.findAllByRole("heading", { name: "Palestra de Dados" });

    // Upper case on purpose: the term travels verbatim and the API folds case.
    await search(user, "REACT");

    // "Oficina de React" is on screen before the search too, so the unmatched
    // action leaving is what marks the filtered response as rendered.
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Palestra de Dados" }),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getAllByRole("heading", { name: "Oficina de React" })[0],
    ).toBeInTheDocument();
    expect(searches.at(-1)).toBe("REACT");
  });

  it("does not fire one request per character while a word is typed", async () => {
    let requests = 0;
    const searches: (string | null)[] = [];

    server.use(
      http.get("*/activities", ({ request }) => {
        requests += 1;
        searches.push(new URL(request.url).searchParams.get("search"));
        return HttpResponse.json(mockApiActivities);
      }),
    );

    // The one test that types character by character against a real debounce
    // window, which is its whole subject.
    const { user } = renderDashboard(SEARCH_DEBOUNCE_MS);

    await screen.findAllByRole("heading", { name: "Oficina de React" });
    const afterFirstLoad = requests;

    await user.type(
      screen.getByRole("searchbox", { name: SEARCH_FIELD }),
      "React",
    );

    await waitFor(() => {
      expect(searches.at(-1)).toBe("React");
    });

    expect(requests).toBe(afterFirstLoad + 1);
  });

  it("sends the term and a select filter in the same request", async () => {
    const queries: URLSearchParams[] = [];

    server.use(
      http.get("*/activities", ({ request }) => {
        queries.push(new URL(request.url).searchParams);
        return HttpResponse.json(mockApiActivities);
      }),
    );

    const { user } = renderDashboard();

    await screen.findAllByRole("heading", { name: "Oficina de React" });

    await search(user, "React");
    await waitFor(() => {
      expect(queries.at(-1)?.get("search")).toBe("React");
    });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Tipos de ação" }),
      "palestra",
    );

    await waitFor(() => {
      expect(queries.at(-1)?.get("type")).toBe("LECTURE");
    });
    expect(queries.at(-1)?.get("search")).toBe("React");
  });

  it("fires the request immediately when a select filter changes", async () => {
    let requests = 0;

    server.use(
      http.get("*/activities", () => {
        requests += 1;
        return HttpResponse.json(mockApiActivities);
      }),
    );

    const { user } = renderDashboard();

    await screen.findAllByRole("heading", { name: "Oficina de React" });
    const afterFirstLoad = requests;

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Disponibilidade" }),
      "available",
    );

    expect(requests).toBe(afterFirstLoad + 1);
  });

  it("restarts the pagination at page 1 when the term changes", async () => {
    const pages: (string | null)[] = [];

    server.use(
      http.get("*/activities", ({ request }) => {
        pages.push(new URL(request.url).searchParams.get("page"));
        return HttpResponse.json({ ...mockApiActivities, totalPages: 3 });
      }),
    );

    const { user } = renderDashboard();

    await screen.findAllByRole("heading", { name: "Oficina de React" });

    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => {
      expect(pages.at(-1)).toBe("2");
    });

    await search(user, "React");
    await waitFor(() => {
      expect(pages.at(-1)).toBe("1");
    });
  });

  it("names the term in the empty state and clears it on demand", async () => {
    server.use(
      http.get("*/activities", ({ request }) => {
        const term = new URL(request.url).searchParams.get("search");

        return term
          ? HttpResponse.json({
              activities: [],
              total: 0,
              page: 1,
              limit: 20,
              totalPages: 0,
            })
          : HttpResponse.json(mockApiActivities);
      }),
    );

    const { user } = renderDashboard();

    await screen.findAllByRole("heading", { name: "Oficina de React" });

    await search(user, "xilofone");

    expect(
      await screen.findByText('Nenhuma ação encontrada para "xilofone".'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpar busca" }));

    expect(
      (await screen.findAllByRole("heading", { name: "Oficina de React" }))[0],
    ).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: SEARCH_FIELD })).toHaveValue(
      "",
    );
  });

  it("shows the error message when the search request fails", async () => {
    server.use(
      http.get("*/activities", ({ request }) => {
        const term = new URL(request.url).searchParams.get("search");

        return term
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json(mockApiActivities);
      }),
    );

    const { user } = renderDashboard();

    await screen.findAllByRole("heading", { name: "Oficina de React" });

    await search(user, "React");

    expect(
      await screen.findByText(
        "Não foi possível carregar as ações. Tente novamente.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the Helpa feed usable when the SIGAA feed fails", async () => {
    server.use(
      http.get("*/activities", () => HttpResponse.json(mockApiActivities)),
      http.get(
        `${API}/sigaa-activities`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    const { user } = render(<Dashboard />);

    await screen.findAllByRole("heading", { name: "Oficina de React" });

    await user.click(screen.getByRole("tab", { name: "SIGAA" }));

    expect(
      await screen.findByText("Não foi possível carregar as ações do SIGAA"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Explorar ações no Helpa" }),
    );

    const actionTitles = await screen.findAllByRole("heading", {
      name: "Oficina de React",
    });
    expect(actionTitles[0]).toBeInTheDocument();
  });
});
