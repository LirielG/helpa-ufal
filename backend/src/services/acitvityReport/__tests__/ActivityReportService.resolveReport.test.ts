import { describe, it, expect, vi } from "vitest";
import ActivityReportService from "../ActivityReportService.js";
import type { IActivityReportRepository } from "@/repositories/activityReport/IActivityReportRepository.js";
import type { ReportResponse } from "@/types/activityReport.js";
import { expectCustomError, expectValidationError } from "@/utils/tests.js";

const MANAGER_ID = "a1b2c3d4-0000-4000-8000-000000000001";
const REPORT_ID = "b2c3d4e5-0000-4000-8000-000000000007";
const RESOLVED_AT = new Date("2026-06-10T12:00:00.000Z");

function aReport(overrides: Partial<ReportResponse> = {}): ReportResponse {
  return {
    id: REPORT_ID,
    category: "MISINFORMATION",
    description: "The address provided is incorrect.",
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
  found = aReport(),
  resolved = aReport({ resolvedAt: RESOLVED_AT }),
}: {
  found?: ReportResponse | null;
  resolved?: ReportResponse | null;
} = {}) {
  const reportRepository = {
    findById: vi.fn().mockResolvedValue(found),
    resolve: vi.fn().mockResolvedValue(resolved),
  } as unknown as IActivityReportRepository;

  const service = new ActivityReportService({
    activityReportRepository: reportRepository,
  });

  return { service, reportRepository };
}

describe("ActivityReportService.resolveReport", () => {
  // ---------- Happy path ----------

  it("resolves an open report on behalf of the requester and returns the repository's DTO", async () => {
    const resolved = aReport({ resolvedAt: RESOLVED_AT });
    const { service, reportRepository } = setup({ resolved });

    const response = await service.resolveReport(REPORT_ID, MANAGER_ID);

    expect(reportRepository.findById).toHaveBeenCalledWith(REPORT_ID);
    expect(reportRepository.resolve).toHaveBeenCalledTimes(1);
    expect(reportRepository.resolve).toHaveBeenCalledWith(
      REPORT_ID,
      MANAGER_ID,
    );
    expect(response).toBe(resolved);
  });

  it("returns a report whose reporter was removed with reporter null", async () => {
    const resolved = aReport({ resolvedAt: RESOLVED_AT, reporter: null });
    const { service } = setup({ found: aReport({ reporter: null }), resolved });

    const response = await service.resolveReport(REPORT_ID, MANAGER_ID);

    expect(response.reporter).toBeNull();
  });

  // ---------- Idempotency ----------

  it("returns an already resolved report unchanged, without writing again", async () => {
    const alreadyResolved = aReport({ resolvedAt: RESOLVED_AT });
    const { service, reportRepository } = setup({ found: alreadyResolved });

    const response = await service.resolveReport(REPORT_ID, MANAGER_ID);

    expect(response).toBe(alreadyResolved);
    expect(reportRepository.resolve).not.toHaveBeenCalled();
  });

  // ---------- Format and existence ----------

  it("returns 400 INVALID_UUID on reportId for a malformed id, without querying", async () => {
    const { service, reportRepository } = setup();

    await expectValidationError(service.resolveReport("123", MANAGER_ID), [
      {
        field: "reportId",
        code: "INVALID_UUID",
        message: "reportId must be a valid UUID.",
      },
    ]);
    expect(reportRepository.findById).not.toHaveBeenCalled();
  });

  it("returns 404 for a well-formed id with no report", async () => {
    const { service, reportRepository } = setup({ found: null });

    await expectCustomError(
      service.resolveReport(REPORT_ID, MANAGER_ID),
      404,
      "Report not found.",
    );
    expect(reportRepository.resolve).not.toHaveBeenCalled();
  });

  it("returns 404 when the report disappears between the read and the write", async () => {
    const { service } = setup({ resolved: null });

    await expectCustomError(
      service.resolveReport(REPORT_ID, MANAGER_ID),
      404,
      "Report not found.",
    );
  });
});
