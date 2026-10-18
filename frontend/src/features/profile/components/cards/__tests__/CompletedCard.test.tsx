import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { useLocation } from "react-router";
import { render, screen, waitFor } from "@/test/render";
import { API, delay, http, HttpResponse, server } from "@/test/http";
import { makeUserActivity } from "@/test/factories";
import { signIn } from "@/test/auth";
import { useSessionExpiry } from "@/hooks/useSessionExpiry";
import type { UserActivity } from "../../../types";
import { CompletedCard } from "../CompletedCard";

const CERTIFICATE_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const FILE_URL = `${API}/certificates/${CERTIFICATE_ID}/file`;
const BLOB_URL = "blob:http://localhost/certificado";

const DOWNLOAD_ERROR_MESSAGE =
  "Não foi possível baixar o certificado. Tente novamente.";
const UNAVAILABLE_MESSAGE =
  "Este certificado não está mais disponível. Recarregue a página para ver a situação atual.";

function completed(): UserActivity {
  return makeUserActivity({ action: { status: "COMPLETED" } });
}

function certified(): UserActivity {
  return {
    ...completed(),
    certificate: {
      id: CERTIFICATE_ID,
      validationCode: "7KQ4MX9T2R",
      issuedAt: "2026-03-18T12:00:00.000Z",
    },
    confirmedWorkloadHours: 18,
  };
}

/** Mounts the session handler the way AppRoutes does, and shows the current path. */
function SessionProbe() {
  useSessionExpiry();
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderCard(activity: UserActivity) {
  return render(
    <>
      <SessionProbe />
      <CompletedCard activity={activity} />
    </>,
    { route: "/profile" },
  );
}

/** Answers the file route with `respond` and counts the requests it received. */
function serveFile(
  respond: () => Response | Promise<Response> = () =>
    new HttpResponse("%PDF-1.7", {
      headers: { "Content-Type": "application/pdf" },
    }),
) {
  const requests: Request[] = [];
  server.use(
    http.get(FILE_URL, ({ request }) => {
      requests.push(request);
      return respond();
    }),
  );
  return requests;
}

// The card's only button; its label changes to "Baixando..." mid-download.
function downloadButton() {
  return screen.getByRole("button");
}

// jsdom implements neither object URLs nor the navigation an anchor click
// starts, so both are replaced by recorders.
let createObjectURL: Mock<typeof URL.createObjectURL>;
let revokeObjectURL: Mock<typeof URL.revokeObjectURL>;
let downloads: Array<{ href: string; name: string }>;

beforeEach(() => {
  createObjectURL = vi.fn<typeof URL.createObjectURL>(() => BLOB_URL);
  revokeObjectURL = vi.fn<typeof URL.revokeObjectURL>();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;

  downloads = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push({ href: this.href, name: this.download });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CompletedCard without a certificate", () => {
  it("shows only the action, with its planned hours and nothing about a certificate", () => {
    renderCard(completed());

    expect(screen.getByText("Atividade de Teste")).toBeInTheDocument();
    expect(screen.getByText("20 horas")).toBeInTheDocument();
    expect(screen.queryByText(/certificado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/homologad/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("CompletedCard with a certificate", () => {
  it("shows the homologated hours, the hyphenated code and the download button", () => {
    renderCard(certified());

    expect(screen.getByText("18 horas homologadas")).toBeInTheDocument();
    expect(screen.queryByText("20 horas")).not.toBeInTheDocument();
    expect(screen.getByText("7KQ4M-X9T2R")).toBeInTheDocument();
    expect(downloadButton()).toHaveTextContent("Baixar certificado");
    expect(downloadButton()).toBeEnabled();
  });

  it("downloads the PDF under the validation code and releases the object URL", async () => {
    signIn();
    const requests = serveFile();
    const { user } = renderCard(certified());

    await user.click(downloadButton());

    await waitFor(() =>
      expect(downloads).toEqual([
        { href: BLOB_URL, name: "certificado-7KQ4MX9T2R.pdf" },
      ]),
    );
    expect(requests).toHaveLength(1);
    expect(requests[0].credentials).toBe("include");
    expect(createObjectURL).toHaveBeenCalledOnce();
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith(BLOB_URL));
  });

  it("disables the button while the download runs and fires a single request on a double click", async () => {
    signIn();
    const requests = serveFile(async () => {
      await delay(50);
      return new HttpResponse("%PDF-1.7", {
        headers: { "Content-Type": "application/pdf" },
      });
    });
    const { user } = renderCard(certified());

    await user.dblClick(downloadButton());

    expect(downloadButton()).toBeDisabled();
    expect(downloadButton()).toHaveTextContent("Baixando...");

    await waitFor(() => expect(downloadButton()).toBeEnabled());
    expect(requests).toHaveLength(1);
    expect(downloads).toHaveLength(1);
  });

  it.each([
    ["a network failure", () => HttpResponse.error()],
    [
      "a 500",
      () =>
        HttpResponse.json(
          { status: 500, message: "Internal server error." },
          { status: 500 },
        ),
    ],
  ])(
    "shows a pt-BR message in the card on %s and lets the user retry",
    async (_case, respond) => {
      signIn();
      serveFile(respond);
      const { user } = renderCard(certified());

      await user.click(downloadButton());

      expect(
        await screen.findByText(DOWNLOAD_ERROR_MESSAGE),
      ).toBeInTheDocument();
      expect(screen.getByText("Atividade de Teste")).toBeInTheDocument();
      expect(downloadButton()).toBeEnabled();
      expect(downloads).toEqual([]);
    },
  );

  // The API answers 404 once the attendance stops attesting presence, so a
  // retry would fail the same way.
  it("explains the certificate is gone on a 404 and stops offering the download", async () => {
    signIn();
    serveFile(() =>
      HttpResponse.json(
        { status: 404, message: "Certificate not found." },
        { status: 404 },
      ),
    );
    const { user } = renderCard(certified());

    await user.click(downloadButton());

    expect(await screen.findByText(UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(DOWNLOAD_ERROR_MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Atividade de Teste")).toBeInTheDocument();
    expect(downloads).toEqual([]);
  });

  it("sends the user to the login screen on 401", async () => {
    signIn();
    serveFile(() =>
      HttpResponse.json(
        { status: 401, message: "No token provided." },
        { status: 401 },
      ),
    );
    const { user } = renderCard(certified());

    await user.click(downloadButton());

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/login"),
    );
    expect(downloads).toEqual([]);
  });
});
