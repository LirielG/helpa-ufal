import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import { http, HttpResponse, server } from "@/test/http";
import { makeActionDetail } from "@/test/factories";
import { signIn } from "@/test/auth";
import { ActionDetail } from "../ActionDetail";

const API = process.env.VITE_API_URL || "http://localhost:3333/api";

describe("ActionDetail Integration", () => {
  beforeEach(() => {
    server.resetHandlers();
    signIn(); // Ensure user is authenticated
  });

  it("displays workload hours in singular when workload is 1 hour", async () => {
    const actionId = "act-singular-workload";
    const action = makeActionDetail({
      id: actionId,
      details: {
        ...makeActionDetail().details!,
        workloadHours: 1,
      },
    });

    server.use(
      http.get(`${API}/activities/${actionId}`, () =>
        HttpResponse.json(action),
      ),
    );

    render(<ActionDetail />, {
      route: `/activity/${actionId}`,
      path: "/activity/:id",
    });

    expect(await screen.findByText("1 hora")).toBeInTheDocument();
  });

  it.each([0, 500, 404])(
    "keeps the action and enrollment success when refresh fails with %s",
    async (status) => {
      const actionId = "act-refresh-failure";
      const action = makeActionDetail({
        id: actionId,
        slots: 20,
        availableSlots: 5,
      });
      let calls = 0;
      server.use(
        http.get(`${API}/activities/${actionId}`, () => {
          calls += 1;
          if (calls === 1) return HttpResponse.json(action);
          return status === 0
            ? HttpResponse.error()
            : new HttpResponse(null, { status });
        }),
        http.put(
          `${API}/activities/${actionId}/enrollments/me`,
          () => new HttpResponse(null, { status: 201 }),
        ),
      );
      const { user } = render(<ActionDetail />, {
        route: `/activity/${actionId}`,
        path: "/activity/:id",
      });

      await user.click(
        await screen.findByRole("button", { name: /Inscrever-se/ }),
      );
      await user.click(screen.getByRole("button", { name: /Confirmar/ }));

      expect(
        await screen.findByText("Inscrição realizada."),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      await waitFor(() => expect(calls).toBe(2));

      expect(
        screen.getByRole("heading", { name: action.title }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("5 disponíveis / 20 no total"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Ação não encontrada."),
      ).not.toBeInTheDocument();
    },
  );

  it.each([201, 200])(
    "refreshes the action after enrollment returns %i",
    async (status) => {
      const actionId = "act-integration-test";
      let getCallCount = 0;

      // Initial action with 5 available slots
      const initialAction = makeActionDetail({
        id: actionId,
        availableSlots: 5,
        slots: 20,
        enrollmentStatus: null,
      });

      // Updated action with 4 available slots (after enrollment)
      const updatedAction = makeActionDetail({
        id: actionId,
        availableSlots: 4,
        slots: 20,
        enrollmentStatus: "APPROVED",
      });

      server.use(
        http.get(`${API}/activities/${actionId}`, () => {
          getCallCount += 1;
          // First call returns 5 slots, second call returns 4 slots
          return HttpResponse.json(
            getCallCount === 1 ? initialAction : updatedAction,
          );
        }),
        http.put(`${API}/activities/${actionId}/enrollments/me`, () =>
          HttpResponse.json(
            {
              id: "enrollment-1",
              activityId: actionId,
              userId: "user-1",
              status: "APPROVED",
              attendanceConfirmed: null,
              confirmedWorkloadHours: 0,
              createdAt: "2026-09-11T00:00:00.000Z",
              updatedAt: "2026-09-11T00:00:00.000Z",
            },
            { status },
          ),
        ),
      );

      const { user } = render(<ActionDetail />, {
        route: `/activity/${actionId}`,
        path: "/activity/:id",
      });

      // Click "Inscrever-se" button
      const enrollButton = await screen.findByRole("button", {
        name: /Inscrever-se/i,
      });

      expect(
        screen.getByText("5 disponíveis / 20 no total"),
      ).toBeInTheDocument();

      await user.click(enrollButton);

      expect(screen.getByText("Confirmar inscrição")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Confirmar/i }));

      expect(
        await screen.findByText("Inscrição realizada."),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });

      expect(
        await screen.findByRole("button", { name: /Cancelar inscrição/i }),
      ).toBeInTheDocument();
      expect(screen.getByText("Inscrito")).toBeInTheDocument();
      expect(
        screen.getByText("4 disponíveis / 20 no total"),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Voltar para o feed/i }),
      ).not.toBeInTheDocument();
      expect(getCallCount).toBe(2);
    },
  );

  it("shows enrollment modal with action details", async () => {
    const actionId = "act-modal-details";
    const action = makeActionDetail({
      id: actionId,
      title: "Advanced React Workshop",
      availableSlots: 10,
    });

    server.use(
      http.get(`${API}/activities/${actionId}`, () =>
        HttpResponse.json(action),
      ),
    );

    const { user } = render(<ActionDetail />, {
      route: `/activity/${actionId}`,
      path: "/activity/:id",
    });

    // Wait for page to load
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Inscrever-se/i }),
      ).toBeInTheDocument();
    });

    // Click enroll button
    const enrollButton = screen.getByRole("button", { name: /Inscrever-se/i });
    await user.click(enrollButton);

    // Verify modal appears with confirm instruction text
    await waitFor(() => {
      expect(screen.getByText("Confirmar inscrição")).toBeInTheDocument();
    });
  });

  it("disables enroll button when no slots available", async () => {
    const actionId = "act-no-slots";
    const action = makeActionDetail({
      id: actionId,
      availableSlots: 0,
      slots: 20,
    });

    server.use(
      http.get(`${API}/activities/${actionId}`, () =>
        HttpResponse.json(action),
      ),
    );

    render(<ActionDetail />, {
      route: `/activity/${actionId}`,
      path: "/activity/:id",
    });

    // Wait for load
    await waitFor(() => {
      expect(
        screen.getByText("0 disponíveis / 20 no total"),
      ).toBeInTheDocument();
    });

    // Button should be disabled with "Vagas esgotadas" text
    const enrollButton = screen.getByRole("button", {
      name: /Vagas esgotadas/i,
    });
    expect(enrollButton).toBeDisabled();
  });
});
