import { describe, expect, it } from "vitest";
import {
  API,
  http,
  HttpResponse,
  makeAction,
  makePage,
  render,
  screen,
  server,
  waitFor,
} from "@/test";
import { FeedSection } from "../FeedSection";
import { useLocation } from "react-router";

function SearchDisplay() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

describe("FeedSection", () => {
  it("renders the FeedTabs and opens with 'Inscrições abertas' without status in the URL or API query", async () => {
    const requestedStatuses: Array<string | null> = [];

    server.use(
      http.get(`${API}/activities`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("limit") === "4") {
          return HttpResponse.json(makePage([]));
        }
        requestedStatuses.push(url.searchParams.get("status"));
        return HttpResponse.json(
          makePage([makeAction({ id: "1", title: "Ação Aberta Futura" })]),
        );
      }),
    );

    render(
      <>
        <FeedSection debounceMs={0} />
        <SearchDisplay />
      </>,
      { route: "/dashboard" },
    );

    expect(screen.getByRole("tab", { name: /Helpa/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /SIGAA/i })).toBeInTheDocument();

    const situacaoSelect = screen.getByRole("combobox", { name: "Situação" });
    expect(situacaoSelect).toHaveValue("OPEN");
    expect(screen.getByTestId("location-search")).toHaveTextContent("");

    expect(await screen.findByText("Ação Aberta Futura")).toBeInTheDocument();
    expect(requestedStatuses).toEqual([null]);
  });

  it("updates the URL and refetches when changing 'Situação', omitting status from URL when returning to default", async () => {
    const requestedStatuses: Array<string | null> = [];

    server.use(
      http.get(`${API}/activities`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("limit") !== "4") {
          const status = url.searchParams.get("status");
          requestedStatuses.push(status);
          return HttpResponse.json(
            makePage([
              makeAction({
                id: status ?? "open-1",
                title:
                  status === "COMPLETED"
                    ? "Ação Concluída"
                    : "Ação Aberta Futura",
                status: status === "COMPLETED" ? "COMPLETED" : "OPEN",
              }),
            ]),
          );
        }
        return HttpResponse.json(makePage([]));
      }),
    );

    const { user } = render(
      <>
        <FeedSection debounceMs={0} />
        <SearchDisplay />
      </>,
      { route: "/dashboard" },
    );

    expect(await screen.findByText("Ação Aberta Futura")).toBeInTheDocument();

    const situacaoSelect = screen.getByRole("combobox", { name: "Situação" });
    await user.selectOptions(situacaoSelect, "COMPLETED");

    expect(await screen.findByText("Ação Concluída")).toBeInTheDocument();
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "?status=COMPLETED",
    );
    expect(requestedStatuses).toEqual([null, "COMPLETED"]);

    await user.selectOptions(situacaoSelect, "OPEN");

    await waitFor(() =>
      expect(screen.getByTestId("location-search")).toHaveTextContent(""),
    );
    expect(await screen.findByText("Ação Aberta Futura")).toBeInTheDocument();
    expect(requestedStatuses).toEqual([null, "COMPLETED", null]);
  });

  it("restores the selected 'Situação' from the URL on initial load", async () => {
    const requestedStatuses: Array<string | null> = [];

    server.use(
      http.get(`${API}/activities`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("limit") === "4") {
          return HttpResponse.json(makePage([]));
        }
        requestedStatuses.push(url.searchParams.get("status"));
        return HttpResponse.json(
          makePage([makeAction({ id: "past-open", title: "Ação Passada" })]),
        );
      }),
    );

    render(<FeedSection debounceMs={0} />, { route: "/dashboard?status=ALL" });

    expect(screen.getByRole("combobox", { name: "Situação" })).toHaveValue(
      "ALL",
    );
    expect(await screen.findByText("Ação Passada")).toBeInTheDocument();
    expect(requestedStatuses).toEqual(["ALL"]);
  });
});