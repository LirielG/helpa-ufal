import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test";
import { SearchField } from "../SearchField";

function renderField(value = "") {
  const onChange = vi.fn();
  const view = render(
    <SearchField
      value={value}
      onChange={onChange}
      label="Buscar ações"
      placeholder="Buscar ações..."
    />,
  );

  return { ...view, onChange };
}

describe("SearchField", () => {
  it("exposes a search box named after its label", () => {
    renderField("robótica");

    expect(screen.getByRole("searchbox", { name: "Buscar ações" })).toHaveValue(
      "robótica",
    );
  });

  it("reports the typed value, not the event", async () => {
    const { user, onChange } = renderField();

    await user.type(
      screen.getByRole("searchbox", { name: "Buscar ações" }),
      "a",
    );

    expect(onChange).toHaveBeenCalledExactlyOnceWith("a");
  });

  it("submits without reloading the page", async () => {
    const onSubmit = vi.fn();
    const { user } = renderField();

    document.body.addEventListener("submit", onSubmit);

    try {
      await user.type(
        screen.getByRole("searchbox", { name: "Buscar ações" }),
        "{Enter}",
      );

      expect(onSubmit).toHaveBeenCalledOnce();
      expect(onSubmit.mock.calls[0][0].defaultPrevented).toBe(true);
    } finally {
      document.body.removeEventListener("submit", onSubmit);
    }
  });

  it("marks the icon as decorative so it is not announced", () => {
    renderField();

    expect(
      screen.getByRole("search").querySelector("svg[aria-hidden='true']"),
    ).toBeInTheDocument();
  });
});
