import { describe, expect, it } from "vitest";
import { makeActionDetail, render, screen } from "@/test";
import { ACTION_FORMAT_LABELS } from "@/features/dashboard/constants";
import type { ActivityFormat } from "@/services/contracts/activity";
import { ActionSummary } from "../ActionSummary";

describe("ActionSummary", () => {
  it.each(Object.entries(ACTION_FORMAT_LABELS) as [ActivityFormat, string][])(
    "renders the %s modality as a pill badge",
    (format, label) => {
      const base = makeActionDetail();
      render(
        <ActionSummary
          action={{
            ...base,
            details: {
              ...base.details!,
              format,
              address: format === "ONLINE" ? null : base.details!.address,
            },
          }}
        />,
      );

      const badge = screen.getByText(label);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("rounded-full", "text-xs", "font-semibold");
    },
  );

  it("renders city and state as plain text alongside the modality badge when address is present", () => {
    const base = makeActionDetail();
    render(
      <ActionSummary
        action={{
          ...base,
          details: {
            ...base.details!,
            format: "HYBRID",
            address: {
              ...base.details!.address!,
              city: "Maceió",
              state: "AL",
            },
          },
        }}
      />,
    );

    const badge = screen.getByText("Híbrido");
    expect(badge).toHaveClass("rounded-full", "text-xs", "font-semibold");

    const location = screen.getByText("Maceió - AL");
    expect(location).toBeInTheDocument();
    expect(location).not.toHaveClass("rounded-full");
  });

  it("does not duplicate the modality label as plain text when there is no address", () => {
    const base = makeActionDetail();
    render(
      <ActionSummary
        action={{
          ...base,
          details: {
            ...base.details!,
            format: "ONLINE",
            address: null,
          },
        }}
      />,
    );

    expect(screen.getAllByText("On-line")).toHaveLength(1);
  });

  it("falls back to the campus label when details are absent", () => {
    const base = makeActionDetail({ campus: "ARAPIRACA" });
    render(<ActionSummary action={{ ...base, details: null }} />);

    expect(screen.getByText("UFAL - Campus Arapiraca")).toBeInTheDocument();
  });
});
