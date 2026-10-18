import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { ProfileTabs } from "../ProfileTabs";

describe("ProfileTabs", () => {
  // Certificates live on the completed-action card, so there is no tab for them.
  it("offers only the personal data and the actions tabs", () => {
    render(<ProfileTabs activeTab="personal" onChange={vi.fn()} />);

    expect(screen.getAllByRole("button").map((tab) => tab.textContent)).toEqual(
      ["Dados Pessoais", "Ações"],
    );
  });
});
