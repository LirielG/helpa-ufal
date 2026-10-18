import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import { API, http, HttpResponse, server } from "@/test/http";
import { makeAction } from "@/test/factories";
import { signIn } from "@/test/auth";
import { ActionsList } from "../ActionsList";

const DELETED_TITLE = "Ação a ser excluída";
const KEPT_TITLE = "Ação que permanece";

function mockManagedActions(authorId: string) {
  const deleted = makeAction({ authorId, title: DELETED_TITLE });
  const kept = makeAction({ authorId, title: KEPT_TITLE });

  server.use(
    http.get(`${API}/activities`, () =>
      HttpResponse.json({ activities: [deleted, kept], total: 2 }),
    ),
  );

  return deleted;
}

async function openManagedTab() {
  const view = render(<ActionsList />, { route: "/profile" });
  await view.user.click(
    screen.getByRole("button", { name: "Atividades Gerenciadas" }),
  );
  await screen.findByText(DELETED_TITLE);
  return view;
}

describe("ActionsList deletion", () => {
  it("removes the deleted action from the list without reloading", async () => {
    const author = signIn();
    const deleted = mockManagedActions(author.id);
    server.use(
      http.delete(
        `${API}/activities/${deleted.id}`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const { user } = await openManagedTab();

    const [firstDelete] = screen.getAllByRole("button", {
      name: "Excluir atividade",
    });
    await user.click(firstDelete);
    await user.click(screen.getByRole("button", { name: "Sim" }));
    await user.click(await screen.findByRole("button", { name: "Fechar" }));

    expect(screen.queryByText(DELETED_TITLE)).not.toBeInTheDocument();
    expect(screen.getByText(KEPT_TITLE)).toBeInTheDocument();
  });

  it("removes an action already deleted elsewhere without showing an error", async () => {
    const author = signIn();
    const deleted = mockManagedActions(author.id);
    server.use(
      http.delete(`${API}/activities/${deleted.id}`, () =>
        HttpResponse.json({ message: "Not found" }, { status: 404 }),
      ),
    );
    const { user } = await openManagedTab();

    const [firstDelete] = screen.getAllByRole("button", {
      name: "Excluir atividade",
    });
    await user.click(firstDelete);
    await user.click(screen.getByRole("button", { name: "Sim" }));

    await waitFor(() =>
      expect(screen.queryByText(DELETED_TITLE)).not.toBeInTheDocument(),
    );
    expect(screen.getByText(KEPT_TITLE)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
