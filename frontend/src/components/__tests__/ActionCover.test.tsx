import { describe, expect, it } from "vitest";
import { render, screen } from "@/test";
import { ActionCover } from "../ActionCover";

describe("ActionCover", () => {
  it("is announced as an image named after the action title", () => {
    render(
      <ActionCover id="action-42" type="COURSE" title="Oficina de Robótica" />,
    );

    expect(
      screen.getByRole("img", { name: "Oficina de Robótica" }),
    ).toBeInTheDocument();
  });

  it("renders the same cover when the same action is rendered twice", () => {
    const { unmount } = render(
      <ActionCover id="action-42" type="COURSE" title="Oficina" />,
    );
    const first = screen.getByRole("img", { name: "Oficina" });
    const firstVariant = first.getAttribute("data-cover-variant");
    const firstStyle = first.getAttribute("style");
    unmount();

    render(<ActionCover id="action-42" type="COURSE" title="Oficina" />);
    const second = screen.getByRole("img", { name: "Oficina" });

    expect(second.getAttribute("data-cover-variant")).toBe(firstVariant);
    expect(second.getAttribute("style")).toBe(firstStyle);
  });

  it("does not render every action with the same cover", () => {
    render(
      <>
        {Array.from({ length: 12 }, (_, i) => (
          <ActionCover
            key={i}
            id={`action-${i}`}
            type="EVENT"
            title={`Ação ${i}`}
          />
        ))}
      </>,
    );

    const variants = new Set(
      screen
        .getAllByRole("img")
        .map((el) => el.getAttribute("data-cover-variant")),
    );

    expect(variants.size).toBeGreaterThan(1);
  });
});
