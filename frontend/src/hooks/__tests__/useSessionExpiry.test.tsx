import { act, render, screen } from "@/test";
import { useLocation, useNavigate } from "react-router";
import { makeUser } from "@/test";
import { describe, expect, it } from "vitest";
import { useSessionExpiry } from "../useSessionExpiry";
import { notifySessionExpired } from "@/services/session";
import { useAuthStore } from "@/stores/authStore";

function LocationProbe() {
  useSessionExpiry();
  return <div>{useLocation().pathname}</div>;
}

describe("useSessionExpiry", () => {
  it("clears the user and navigates to /login when the session expires", () => {
    useAuthStore.getState().setUser(makeUser());

    render(<LocationProbe />, { route: "/dashboard" });

    act(() => notifySessionExpired());

    expect(useAuthStore.getState().user).toBeNull();
    expect(screen.getByText("/login")).toBeInTheDocument();
  });

  it("uses replace: nothing stays in the history behind the login screen", async () => {
    function BackProbe() {
      useSessionExpiry();
      const navigate = useNavigate();
      return (
        <>
          <div>{useLocation().pathname}</div>
          <button onClick={() => navigate(-1)}>voltar</button>
        </>
      );
    }

    const { user } = render(<BackProbe />, { route: "/dashboard" });

    act(() => notifySessionExpired());

    expect(screen.getByText("/login")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "voltar" }));

    expect(screen.getByText("/login")).toBeInTheDocument();
  });

  it("stops reacting after being unmounted", () => {
    useAuthStore.getState().setUser(makeUser());

    const { unmount } = render(<LocationProbe />, { route: "/dashboard" });
    unmount();

    act(() => notifySessionExpired());

    expect(useAuthStore.getState().user).not.toBeNull();
  });
});