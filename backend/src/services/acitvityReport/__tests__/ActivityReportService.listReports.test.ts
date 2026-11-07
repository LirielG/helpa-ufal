import { describe, it, expect, vi } from "vitest";
import ActivityReportService from "../ActivityReportService.js";
import type { IActivityReportRepository } from "@/repositories/activityReport/IActivityReportRepository.js";
import type { ListReportsQuery } from "@/schemas/activityReport/activityReportSchemas.js";
import type { ReportResponse } from "@/types/activityReport.js";

function aReport(overrides: Partial<ReportResponse> = {}): ReportResponse {
  return {
    id: "b2c3d4e5-0000-4000-8000-000000000007",
    category: "SPAM",
    description: "Repeated promotional content.",
    createdAt: new Date("2026-06-05T19:44:20.000Z"),
    resolvedAt: null,
    activity: {
      id: "22ac40bd-e160-4c6e-8505-b63913d2482f",
      title: "Oficina de Introdução à Programação",
      authorId: "a1b2c3d4-0000-4000-8000-000000000099",
    },
    reporter: {
      id: "a1b2c3d4-0000-4000-8000-000000000042",
      fullName: "Maria Clara Santos",
    },
    ...overrides,
  };
}

function setup({
  page = { items: [aReport()], total: 1 },
}: {
  page?: { items: ReportResponse[]; total: number };
} = {}) {
  const reportRepository = {
    list: vi.fn().mockResolvedValue(page),
  } as unknown as IActivityReportRepository;

  const service = new ActivityReportService({
    activityReportRepository: reportRepository,
  });

  return { service, reportRepository };
}

const query: ListReportsQuery = { page: 1, limit: 20, resolved: false };

describe("ActivityReportService.listReports", () => {
  // ---------- Happy path ----------

  it("passes the parsed query to the repository and wraps the page in the envelope", async () => {
    const report = aReport();
    const { service, reportRepository } = setup({
      page: { items: [report], total: 1 },
    });

    const response = await service.listReports(query);

    expect(reportRepository.list).toHaveBeenCalledTimes(1);
    expect(reportRepository.list).toHaveBeenCalledWith(query);
    expect(response).toEqual({
      items: [report],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it("returns an empty page instead of failing when there are no reports", async () => {
    const { service } = setup({ page: { items: [], total: 0 } });

    const response = await service.listReports(query);

    expect(response).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it("computes totalPages from the filtered total, not from the page size", async () => {
    const { service } = setup({ page: { items: [], total: 41 } });

    const response = await service.listReports({
      page: 5,
      limit: 10,
      resolved: true,
    });

    expect(response).toMatchObject({
      total: 41,
      page: 5,
      limit: 10,
      totalPages: 5,
    });
  });
});
