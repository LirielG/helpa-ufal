import { describe, it, expect } from "vitest";
import {
  API,
  delay,
  http,
  HttpResponse,
  makeActionDetail,
  makeEnrollment,
  render,
  screen,
  server,
  signIn,
  waitFor,
  within,
} from "@/test";
import type { ActivityStatus } from "@/services/contracts/activity";
import type {
  Enrollment,
  EnrollmentListItem,
} from "@/services/contracts/enrollment";

import { EnrollmentsPage } from "@/pages/EnrollmentsPage";

const WORKLOAD = 8;

function renderPage() {
  return render(<EnrollmentsPage />, {
    route: "/activity/act-1/enrollments",
    path: "/activity/:id/enrollments",
  });
}

function serveActivity(status: ActivityStatus = "COMPLETED") {
  const action = makeActionDetail({ id: "act-1", status });
  server.use(
    http.get(`${API}/activities/:id`, () =>
      HttpResponse.json({
        ...action,
        details: { ...action.details!, workloadHours: WORKLOAD },
      }),
    ),
  );
}

function serveList(items: EnrollmentListItem[], totalPresent = 0) {
  server.use(
    http.get(`${API}/activities/:id/enrollments`, () =>
      HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        limit: 20,
        totalPresent,
      }),
    ),
  );
}

/** Answers the attendance route by echoing the body onto the enrollment. */
function serveAttendance(enrollment: EnrollmentListItem) {
  const bodies: unknown[] = [];

  server.use(
    http.put(
      `${API}/enrollments/:enrollmentId/attendance`,
      async ({ request }) => {
        const body = (await request.json()) as {
          attended: boolean;
          workloadHours?: number;
        };
        bodies.push(body);

        const updated: Enrollment = {
          ...enrollment,
          attendanceConfirmed: body.attended,
          confirmedWorkloadHours: body.workloadHours ?? 0,
        };
        return HttpResponse.json(updated);
      },
    ),
  );

  return bodies;
}

function serveAttendanceError(status: number, message: string) {
  server.use(
    http.put(`${API}/enrollments/:enrollmentId/attendance`, () =>
      HttpResponse.json({ message }, { status }),
    ),
  );
}

function rowOf(name: string) {
  return screen.getByRole("row", { name: new RegExp(name) });
}

async function openModal(
  user: ReturnType<typeof renderPage>["user"],
  name: string,
) {
  await user.click(
    await screen.findByRole("button", {
      name: `Homologar presença de ${name}`,
    }),
  );
  return screen.getByRole("dialog");
}

/** Replaces the hours the modal suggests with `value`. */
async function fillHours(
  user: ReturnType<typeof renderPage>["user"],
  dialog: HTMLElement,
  value: string,
) {
  const hours = within(dialog).getByLabelText("Horas cumpridas");
  await user.clear(hours);
  await user.type(hours, value);
}

describe("EnrollmentsPage — attendance", () => {
  it("records a presence with hours, updates the row and the present count", async () => {
    const maria = makeEnrollment({ user: { fullName: "Maria Silva" } });
    serveActivity();
    serveList([maria], 0);
    const bodies = serveAttendance(maria);

    const { user } = renderPage();
    expect(await screen.findByText("0 presentes")).toBeInTheDocument();

    const dialog = await openModal(user, "Maria Silva");
    await user.click(within(dialog).getByLabelText("Presente"));
    await fillHours(user, dialog, "4");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(bodies).toEqual([{ attended: true, workloadHours: 4 }]);
    expect(
      within(rowOf("Maria Silva")).getByText("Presente · 4 h"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 presente")).toBeInTheDocument();
  });

  it("gives a manager who is not the creator the same flow", async () => {
    signIn({ isManager: true });
    const maria = makeEnrollment({ user: { fullName: "Maria Silva" } });
    serveActivity();
    serveList([maria], 0);
    serveAttendance(maria);

    const { user } = renderPage();

    const dialog = await openModal(user, "Maria Silva");
    await user.click(within(dialog).getByLabelText("Presente"));
    await fillHours(user, dialog, "4");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(
      await within(rowOf("Maria Silva")).findByText("Presente · 4 h"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 presente")).toBeInTheDocument();
  });

  it("records an absence with 0 hours, without workloadHours and without counting it as present", async () => {
    const maria = makeEnrollment({ user: { fullName: "Maria Silva" } });
    serveActivity();
    serveList([maria], 0);
    const bodies = serveAttendance(maria);

    const { user } = renderPage();

    const dialog = await openModal(user, "Maria Silva");
    await user.click(within(dialog).getByLabelText("Presente"));
    await fillHours(user, dialog, "4");
    await user.click(within(dialog).getByLabelText("Falta"));

    expect(
      within(dialog).queryByLabelText("Horas cumpridas"),
    ).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(
      await within(rowOf("Maria Silva")).findByText("Falta · 0 h"),
    ).toBeInTheDocument();
    expect(bodies).toEqual([{ attended: false }]);
    expect(screen.getByText("0 presentes")).toBeInTheDocument();
  });

  it("shows the three states distinctly, never an unhomologated enrollment as an absence", async () => {
    serveActivity();
    serveList(
      [
        makeEnrollment({ user: { fullName: "Ana Pendente" } }),
        makeEnrollment({
          user: { fullName: "Bia Presente" },
          attendanceConfirmed: true,
          confirmedWorkloadHours: 6,
        }),
        makeEnrollment({
          user: { fullName: "Caio Faltou" },
          attendanceConfirmed: false,
          confirmedWorkloadHours: 0,
        }),
      ],
      1,
    );

    renderPage();

    const pending = within(
      await screen.findByRole("row", { name: /Ana Pendente/ }),
    );
    expect(pending.getByText("Não homologado")).toBeInTheDocument();
    expect(pending.queryByText(/Falta/)).not.toBeInTheDocument();
    expect(
      within(rowOf("Bia Presente")).getByText("Presente · 6 h"),
    ).toBeInTheDocument();
    expect(
      within(rowOf("Caio Faltou")).getByText("Falta · 0 h"),
    ).toBeInTheDocument();
  });

  it("opens an already homologated enrollment with its current values and overwrites them", async () => {
    const bia = makeEnrollment({
      user: { fullName: "Bia Presente" },
      attendanceConfirmed: true,
      confirmedWorkloadHours: 6,
    });
    serveActivity();
    serveList([bia], 1);
    const bodies = serveAttendance(bia);

    const { user } = renderPage();

    await user.click(
      await screen.findByRole("button", {
        name: "Editar presença de Bia Presente",
      }),
    );
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByLabelText("Presente")).toBeChecked();
    const hours = within(dialog).getByLabelText("Horas cumpridas");
    expect(hours).toHaveValue(6);

    await user.clear(hours);
    await user.type(hours, "3");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    const row = within(rowOf("Bia Presente"));
    expect(await row.findByText("Presente · 3 h")).toBeInTheDocument();
    expect(row.queryByText("Presente · 6 h")).not.toBeInTheDocument();
    expect(bodies).toEqual([{ attended: true, workloadHours: 3 }]);
    expect(screen.getByText("1 presente")).toBeInTheDocument();
  });

  it("opens a recorded absence with Falta selected", async () => {
    serveActivity();
    serveList([
      makeEnrollment({
        user: { fullName: "Caio Faltou" },
        attendanceConfirmed: false,
      }),
    ]);

    const { user } = renderPage();

    await user.click(
      await screen.findByRole("button", {
        name: "Editar presença de Caio Faltou",
      }),
    );
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByLabelText("Falta")).toBeChecked();
    expect(within(dialog).getByLabelText("Presente")).not.toBeChecked();
  });

  it("opens an unhomologated enrollment with no choice made", async () => {
    serveActivity();
    serveList([makeEnrollment({ user: { fullName: "Ana Pendente" } })]);

    const { user } = renderPage();
    const dialog = await openModal(user, "Ana Pendente");

    expect(within(dialog).getByLabelText("Presente")).not.toBeChecked();
    expect(within(dialog).getByLabelText("Falta")).not.toBeChecked();
    expect(
      within(dialog).getByRole("button", { name: "Salvar" }),
    ).toBeDisabled();
  });

  it.each([
    ["0", "As horas devem ser no mínimo 1."],
    ["-2", "As horas devem ser no mínimo 1."],
    ["2.5", "Informe um número inteiro de horas."],
    ["9", "As horas não podem passar da carga horária da ação (8 h)."],
  ])("blocks %s hours before sending", async (typed, message) => {
    const maria = makeEnrollment({ user: { fullName: "Maria Silva" } });
    serveActivity();
    serveList([maria]);
    const bodies = serveAttendance(maria);

    const { user } = renderPage();

    const dialog = await openModal(user, "Maria Silva");
    await user.click(within(dialog).getByLabelText("Presente"));
    await fillHours(user, dialog, typed);
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it.each(["1", String(WORKLOAD)])("accepts %s hours", async (typed) => {
    const maria = makeEnrollment({ user: { fullName: "Maria Silva" } });
    serveActivity();
    serveList([maria]);
    const bodies = serveAttendance(maria);

    const { user } = renderPage();

    const dialog = await openModal(user, "Maria Silva");
    await user.click(within(dialog).getByLabelText("Presente"));
    await fillHours(user, dialog, typed);
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(
      await within(rowOf("Maria Silva")).findByText(`Presente · ${typed} h`),
    ).toBeInTheDocument();
    expect(bodies).toEqual([{ attended: true, workloadHours: Number(typed) }]);
  });

  it("puts a 422 on the hours field", async () => {
    serveActivity();
    serveList([makeEnrollment({ user: { fullName: "Maria Silva" } })]);
    serveAttendanceError(
      422,
      "workloadHours must be an integer between 1 and the activity's workload hours.",
    );

    const { user } = renderPage();

    const dialog = await openModal(user, "Maria Silva");
    await user.click(within(dialog).getByLabelText("Presente"));
    await fillHours(user, dialog, "4");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(
      await within(dialog).findByText(
        "Informe um número inteiro de horas entre 1 e a carga horária da ação.",
      ),
    ).toBeInTheDocument();
    expect(
      within(rowOf("Maria Silva")).getByText("Não homologado"),
    ).toBeInTheDocument();
  });

  it("explains a 403 in the modal", async () => {
    serveActivity();
    serveList([makeEnrollment({ user: { fullName: "Maria Silva" } })]);
    serveAttendanceError(
      403,
      "Only the activity creator or a manager can confirm attendance.",
    );

    const { user } = renderPage();

    const dialog = await openModal(user, "Maria Silva");
    await user.click(within(dialog).getByLabelText("Falta"));
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Você não tem permissão para homologar esta presença.",
    );
  });

  it("on 409 explains that the activity changed and reloads the list and the activity", async () => {
    let listCalls = 0;
    let activityStatus: ActivityStatus = "COMPLETED";
    const maria = makeEnrollment({ user: { fullName: "Maria Silva" } });

    server.use(
      http.get(`${API}/activities/:id/enrollments`, () => {
        listCalls += 1;
        return HttpResponse.json({
          items: [maria],
          total: 1,
          page: 1,
          limit: 20,
          totalPresent: 0,
        });
      }),
      http.get(`${API}/activities/:id`, () =>
        HttpResponse.json(
          makeActionDetail({ id: "act-1", status: activityStatus }),
        ),
      ),
      http.put(`${API}/enrollments/:enrollmentId/attendance`, () => {
        activityStatus = "IN_PROGRESS";
        return HttpResponse.json(
          {
            message:
              "Attendance can only be confirmed for completed activities.",
          },
          { status: 409 },
        );
      }),
    );

    const { user } = renderPage();

    const dialog = await openModal(user, "Maria Silva");
    await user.click(within(dialog).getByLabelText("Falta"));
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText(
        "Esta ação não está mais concluída, então a presença não pode ser homologada.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(listCalls).toBe(2));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Homologar presença/ }),
      ).not.toBeInTheDocument(),
    );
    expect(await screen.findByText("Maria Silva")).toBeInTheDocument();
  });

  it("on 404 says the enrollment is gone and reloads the list", async () => {
    let listCalls = 0;

    server.use(
      http.get(`${API}/activities/:id/enrollments`, () => {
        listCalls += 1;
        return HttpResponse.json({
          items:
            listCalls === 1
              ? [makeEnrollment({ user: { fullName: "Maria Silva" } })]
              : [],
          total: listCalls === 1 ? 1 : 0,
          page: 1,
          limit: 20,
          totalPresent: 0,
        });
      }),
    );
    serveActivity();
    serveAttendanceError(404, "Enrollment not found.");

    const { user } = renderPage();

    const dialog = await openModal(user, "Maria Silva");
    await user.click(within(dialog).getByLabelText("Falta"));
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText("Inscrição não encontrada."),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Nenhum inscrito ainda/),
    ).toBeInTheDocument();
  });

  it("on a network failure shows the error, keeps the modal usable and leaves the row alone", async () => {
    serveActivity();
    serveList([makeEnrollment({ user: { fullName: "Maria Silva" } })]);
    server.use(
      http.put(`${API}/enrollments/:enrollmentId/attendance`, () =>
        HttpResponse.error(),
      ),
    );

    const { user } = renderPage();

    const dialog = await openModal(user, "Maria Silva");
    await user.click(within(dialog).getByLabelText("Falta"));
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Falha de comunicação com o servidor. Tente novamente.",
    );
    expect(
      within(dialog).getByRole("button", { name: "Salvar" }),
    ).toBeEnabled();
    expect(within(dialog).getByLabelText("Presente")).toBeEnabled();
    expect(
      within(rowOf("Maria Silva")).getByText("Não homologado"),
    ).toBeInTheDocument();
  });

  it("sends a single request on a double click", async () => {
    let calls = 0;
    const maria = makeEnrollment({ user: { fullName: "Maria Silva" } });
    serveActivity();
    serveList([maria]);
    server.use(
      http.put(`${API}/enrollments/:enrollmentId/attendance`, async () => {
        calls += 1;
        await delay(50);
        return HttpResponse.json({ ...maria, attendanceConfirmed: false });
      }),
    );

    const { user } = renderPage();

    const dialog = await openModal(user, "Maria Silva");
    await user.click(within(dialog).getByLabelText("Falta"));
    await user.dblClick(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(
      await within(rowOf("Maria Silva")).findByText("Falta · 0 h"),
    ).toBeInTheDocument();
    expect(calls).toBe(1);
  });

  it.each(["OPEN", "IN_PROGRESS", "CANCELLED"] as const)(
    "hides the control when the activity is %s",
    async (status) => {
      serveActivity(status);
      serveList([makeEnrollment({ user: { fullName: "Maria Silva" } })]);

      renderPage();

      expect(await screen.findByText("Maria Silva")).toBeInTheDocument();
      // Let the activity request settle before asserting on its absence.
      expect(await screen.findByText(/vagas preenchidas/)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /presença de/ }),
      ).not.toBeInTheDocument();
    },
  );

  it("brings the confirmed hours back when Falta is clicked by mistake", async () => {
    serveActivity();
    serveList(
      [
        makeEnrollment({
          user: { fullName: "Bia Presente" },
          attendanceConfirmed: true,
          confirmedWorkloadHours: 6,
        }),
      ],
      1,
    );

    const { user } = renderPage();

    await user.click(
      await screen.findByRole("button", {
        name: "Editar presença de Bia Presente",
      }),
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByLabelText("Falta"));
    await user.click(within(dialog).getByLabelText("Presente"));

    expect(within(dialog).getByLabelText("Horas cumpridas")).toHaveValue(6);
  });

  it("drops an earlier error once the choice changes", async () => {
    serveActivity();
    serveList([makeEnrollment({ user: { fullName: "Maria Silva" } })]);
    server.use(
      http.put(`${API}/enrollments/:enrollmentId/attendance`, () =>
        HttpResponse.error(),
      ),
    );

    const { user } = renderPage();

    const dialog = await openModal(user, "Maria Silva");
    await user.click(within(dialog).getByLabelText("Falta"));
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await within(dialog).findByRole("alert");

    await user.click(within(dialog).getByLabelText("Presente"));

    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("closes the modal on Escape", async () => {
    serveActivity();
    serveList([makeEnrollment({ user: { fullName: "Maria Silva" } })]);

    const { user } = renderPage();

    await openModal(user, "Maria Silva");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("suggests the activity's workload for a first presence", async () => {
    serveActivity();
    serveList([makeEnrollment({ user: { fullName: "Ana Pendente" } })]);

    const { user } = renderPage();

    const dialog = await openModal(user, "Ana Pendente");
    await user.click(within(dialog).getByLabelText("Presente"));

    expect(within(dialog).getByLabelText("Horas cumpridas")).toHaveValue(
      WORKLOAD,
    );
  });

  it("suggests the activity's workload when turning an absence into a presence", async () => {
    serveActivity();
    serveList([
      makeEnrollment({
        user: { fullName: "Caio Faltou" },
        attendanceConfirmed: false,
      }),
    ]);

    const { user } = renderPage();

    await user.click(
      await screen.findByRole("button", {
        name: "Editar presença de Caio Faltou",
      }),
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByLabelText("Presente"));

    expect(within(dialog).getByLabelText("Horas cumpridas")).toHaveValue(
      WORKLOAD,
    );
  });
});
