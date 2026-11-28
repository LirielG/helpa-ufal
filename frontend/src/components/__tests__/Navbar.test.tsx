import { describe, expect, it } from "vitest";
import { render, screen, signIn, signOut } from "@/test";
import { Navbar } from "../Navbar";

describe("Navbar", () => {
  // The pages that use it (auth screens, 404) are reached signed out, where a
  // profile shortcut would only bounce the visitor to the login screen.
  it.each([
    ["/forgot-password", "visitor"],
    ["/reset-password", "visitor"],
    ["/rota-inexistente", "signed-in user"],
  ])("shows only the logo link on %s for a %s", (route, viewer) => {
    if (viewer === "visitor") signOut();
    else signIn();

    render(<Navbar />, { route });

    expect(
      screen.queryByRole("button", { name: "Abrir perfil" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Perfil")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
