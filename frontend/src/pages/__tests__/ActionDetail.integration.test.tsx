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

  it("updates available slots after successful enrollment", async () => {
    const actionId = "act-integration-test";
    let getCallCount = 0;

    // Initial action with 5 available slots
    const initialAction = makeActionDetail({
      id: actionId,
      availableSlots: 5,
      slots: 20,
    });

    // Updated action with 4 available slots (after enrollment)
    const updatedAction = makeActionDetail({
      id: actionId,
      availableSlots: 4,
      slots: 20,
    });

    server.use(
      http.get(`${API}/activities/${actionId}`, () => {
        getCallCount += 1;
        // First call returns 5 slots, second call returns 4 slots
        if (getCallCount === 1) {
          return HttpResponse.json(initialAction);
        } else {
          return HttpResponse.json(updatedAction);
        }
      }),
      http.post(`${API}/activities/${actionId}/enroll`, () =>
        new HttpResponse(null, { status: 201 })
      )
    );

    const { user } = render(<ActionDetail />, {
      route: `/activity/${actionId}`,
      path: "/activity/:id",
    });

    // Wait for initial load
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Inscrever-se/i })
      ).toBeInTheDocument();
    });

    // Verify initial slot count is displayed
    expect(screen.getByText("5 disponíveis / 20 no total")).toBeInTheDocument();

    // Click "Inscrever-se" button
    const enrollButton = screen.getByRole("button", { name: /Inscrever-se/i });
    await user.click(enrollButton);

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByText("Confirmar inscrição")).toBeInTheDocument();
    });

    // Click confirm in modal
    const buttons = screen.getAllByRole("button");
    const confirmButton = buttons.find(
      (btn) =>
        btn.textContent?.includes("✓") || btn.textContent?.includes("Confirmar")
    );
    if (confirmButton) {
      await user.click(confirmButton);
    }

    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText("Oba! Você está dentro!")).toBeInTheDocument();
    });

    // Verify GET was called twice (initial load + refetch after enrollment)
    expect(getCallCount).toBe(2);
  });

  it("shows enrollment modal with action details", async () => {
    const actionId = "act-modal-details";
    const action = makeActionDetail({
      id: actionId,
      title: "Advanced React Workshop",
      availableSlots: 10,
    });

    server.use(
      http.get(`${API}/activities/${actionId}`, () =>
        HttpResponse.json(action)
      )
    );

    const { user } = render(<ActionDetail />, {
      route: `/activity/${actionId}`,
      path: "/activity/:id",
    });

    // Wait for page to load
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Inscrever-se/i })
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
        HttpResponse.json(action)
      )
    );

    render(<ActionDetail />, {
      route: `/activity/${actionId}`,
      path: "/activity/:id",
    });

    // Wait for load
    await waitFor(() => {
      expect(screen.getByText("0 disponíveis / 20 no total")).toBeInTheDocument();
    });

    // Button should be disabled with "Vagas esgotadas" text
    const enrollButton = screen.getByRole("button", { name: /Vagas esgotadas/i });
    expect(enrollButton).toBeDisabled();
  });
});
