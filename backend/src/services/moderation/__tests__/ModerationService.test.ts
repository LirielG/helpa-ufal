import { describe, expect, it, vi } from "vitest";
import ModerationService from "../ModerationService.js";
import type {
  ActivityModerationState,
  IModerationRepository,
} from "@/repositories/moderation/IModerationRepository.js";
import type {
  CreateModerationDecisionInput,
  ListReportedActivitiesQuery,
} from "@/schemas/moderation/moderationSchemas.js";
import type {
  ModerationDecisionResponse,
  ReportedActivityItem,
} from "@/types/moderation.js";
import { expectHttpError } from "@/utils/tests.js";

const ACTIVITY_ID = "22ac40bd-e160-4c6e-8505-b63913d2482f";
const AUTHOR_ID = "a1b2c3d4-0000-4000-8000-000000000099";
const MANAGER_ID = "a1b2c3d4-0000-4000-8000-000000000001";
const REPORTER_ID = "a1b2c3d4-0000-4000-8000-000000000042";
const DECISION_ID = "c3d4e5f6-0000-4000-8000-000000000010";
const REPORT_ID = "b2c3d4e5-0000-4000-8000-000000000007";
const CREATED_AT = new Date("2026-06-05T19:44:20.000Z");
const DECIDED_AT = new Date("2026-06-10T12:00:00.000Z");

function aReportedActivity(
  overrides: Partial<ReportedActivityItem> = {},
): ReportedActivityItem {
  return {
    activity: {
      id: ACTIVITY_ID,
      title: "Oficina de Introdução à Programação",
      status: "OPEN",
      authorId: AUTHOR_ID,
      removedByModerationAt: null,
    },
    openReports: [
      {
        id: REPORT_ID,
        category: "SPAM",
        description: "Repeated promotional content.",
        createdAt: CREATED_AT,
        reporter: { id: REPORTER_ID, fullName: "Maria Clara Santos" },
      },
    ],
    decisions: [],
    ...overrides,
  };
}

function aDecision(
  overrides: Partial<ModerationDecisionResponse> = {},
): ModerationDecisionResponse {
  return {
    id: DECISION_ID,
    verdict: "REJECTED",
    justification: "Denúncia improcedente após verificação.",
    createdAt: DECIDED_AT,
    decidedBy: { id: MANAGER_ID, fullName: "Gestor UFAL" },
    reports: [
      {
        id: REPORT_ID,
        category: "SPAM",
        description: "Repeated promotional content.",
        createdAt: CREATED_AT,
        reporter: { id: REPORTER_ID, fullName: "Maria Clara Santos" },
      },
    ],
    ...overrides,
  };
}

function anActivityState(
  overrides: Partial<ActivityModerationState> = {},
): ActivityModerationState {
  return {
    id: ACTIVITY_ID,
    authorId: AUTHOR_ID,
    status: "OPEN",
    removedByModerationAt: null,
    openReportsCount: 2,
    ...overrides,
  };
}

function setup({
  page = { items: [aReportedActivity()], total: 1 },
  activityState = anActivityState(),
  createdDecision = aDecision(),
}: {
  page?: { items: ReportedActivityItem[]; total: number };
  activityState?: ActivityModerationState | null;
  createdDecision?: ModerationDecisionResponse;
} = {}) {
  const moderationRepository: IModerationRepository = {
    listReportedActivities: vi.fn().mockResolvedValue(page),
    findActivityForModeration: vi.fn().mockResolvedValue(activityState),
    createDecision: vi.fn().mockResolvedValue(createdDecision),
  };

  const service = new ModerationService({ moderationRepository });

  return { service, moderationRepository };
}

describe("ModerationService.listReportedActivities", () => {
  const query: ListReportedActivitiesQuery = {
    status: "open",
    page: 1,
    limit: 20,
  };

  it("passes the parsed query to the repository and wraps the result in the paginated envelope", async () => {
    const item = aReportedActivity();
    const { service, moderationRepository } = setup({
      page: { items: [item], total: 1 },
    });

    const response = await service.listReportedActivities(query);

    expect(moderationRepository.listReportedActivities).toHaveBeenCalledTimes(
      1,
    );
    expect(moderationRepository.listReportedActivities).toHaveBeenCalledWith(
      query,
    );
    expect(response).toEqual({
      items: [item],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it("returns an empty page with totalPages 1 when nothing matches", async () => {
    const { service } = setup({ page: { items: [], total: 0 } });

    const response = await service.listReportedActivities(query);

    expect(response).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it("computes totalPages from total rather than the current page length", async () => {
    const { service } = setup({ page: { items: [], total: 41 } });

    const response = await service.listReportedActivities({
      status: "decided",
      page: 5,
      limit: 10,
    });

    expect(response).toMatchObject({
      total: 41,
      page: 5,
      limit: 10,
      totalPages: 5,
    });
  });
});

describe("ModerationService.createDecision", () => {
  const rejectInput: CreateModerationDecisionInput = {
    verdict: "REJECTED",
    justification: "Denúncia improcedente.",
  };
  const upholdInput: CreateModerationDecisionInput = {
    verdict: "UPHELD",
    justification: "Ação viola diretrizes da plataforma.",
  };

  it("delegates a valid decision to the repository and returns its DTO", async () => {
    const createdDecision = aDecision();
    const { service, moderationRepository } = setup({ createdDecision });

    const response = await service.createDecision(
      ACTIVITY_ID,
      MANAGER_ID,
      rejectInput,
    );

    expect(moderationRepository.findActivityForModeration).toHaveBeenCalledWith(
      ACTIVITY_ID,
    );
    expect(moderationRepository.createDecision).toHaveBeenCalledWith(
      ACTIVITY_ID,
      MANAGER_ID,
      rejectInput,
    );
    expect(response).toBe(createdDecision);
  });

  it.each(["OPEN", "IN_PROGRESS", "CANCELLED"] as const)(
    "allows UPHELD when activity status is %s",
    async (status) => {
      const createdDecision = aDecision({ verdict: "UPHELD" });
      const { service, moderationRepository } = setup({
        activityState: anActivityState({ status }),
        createdDecision,
      });

      const response = await service.createDecision(
        ACTIVITY_ID,
        MANAGER_ID,
        upholdInput,
      );

      expect(moderationRepository.createDecision).toHaveBeenCalledWith(
        ACTIVITY_ID,
        MANAGER_ID,
        upholdInput,
      );
      expect(response).toBe(createdDecision);
    },
  );

  it("allows REJECTED when activity status is COMPLETED", async () => {
    const createdDecision = aDecision({ verdict: "REJECTED" });
    const { service, moderationRepository } = setup({
      activityState: anActivityState({ status: "COMPLETED" }),
      createdDecision,
    });

    const response = await service.createDecision(
      ACTIVITY_ID,
      MANAGER_ID,
      rejectInput,
    );

    expect(moderationRepository.createDecision).toHaveBeenCalledTimes(1);
    expect(response).toBe(createdDecision);
  });

  it("throws 404 ACTIVITY_NOT_FOUND when the activity does not exist or is soft-deleted", async () => {
    const { service, moderationRepository } = setup({ activityState: null });

    await expectHttpError(
      service.createDecision(ACTIVITY_ID, MANAGER_ID, rejectInput),
      404,
      "Activity not found.",
      "ACTIVITY_NOT_FOUND",
    );
    expect(moderationRepository.createDecision).not.toHaveBeenCalled();
  });

  it("throws 403 FORBIDDEN when the manager is the author of the activity", async () => {
    const { service, moderationRepository } = setup({
      activityState: anActivityState({
        authorId: MANAGER_ID,
        openReportsCount: 0,
        status: "COMPLETED",
      }),
    });

    await expectHttpError(
      service.createDecision(ACTIVITY_ID, MANAGER_ID, upholdInput),
      403,
      "Activity authors cannot moderate their own activity.",
      "FORBIDDEN",
    );
    expect(moderationRepository.createDecision).not.toHaveBeenCalled();
  });

  it("throws 409 NO_OPEN_REPORTS when the activity has no open reports", async () => {
    const { service, moderationRepository } = setup({
      activityState: anActivityState({ openReportsCount: 0 }),
    });

    await expectHttpError(
      service.createDecision(ACTIVITY_ID, MANAGER_ID, rejectInput),
      409,
      "Activity has no open reports.",
      "NO_OPEN_REPORTS",
    );
    expect(moderationRepository.createDecision).not.toHaveBeenCalled();
  });

  it("prioritizes 409 NO_OPEN_REPORTS over 409 ACTIVITY_COMPLETED", async () => {
    const { service, moderationRepository } = setup({
      activityState: anActivityState({
        status: "COMPLETED",
        openReportsCount: 0,
      }),
    });

    await expectHttpError(
      service.createDecision(ACTIVITY_ID, MANAGER_ID, upholdInput),
      409,
      "Activity has no open reports.",
      "NO_OPEN_REPORTS",
    );
    expect(moderationRepository.createDecision).not.toHaveBeenCalled();
  });

  it("throws 409 ACTIVITY_COMPLETED when verdict is UPHELD on a COMPLETED activity", async () => {
    const { service, moderationRepository } = setup({
      activityState: anActivityState({ status: "COMPLETED" }),
    });

    await expectHttpError(
      service.createDecision(ACTIVITY_ID, MANAGER_ID, upholdInput),
      409,
      "Completed activities cannot be removed by moderation.",
      "ACTIVITY_COMPLETED",
    );
    expect(moderationRepository.createDecision).not.toHaveBeenCalled();
  });

  it("propagates repository errors unchanged", async () => {
    const infraError = new Error("database unavailable");
    const { service, moderationRepository } = setup();
    vi.mocked(moderationRepository.createDecision).mockRejectedValueOnce(
      infraError,
    );

    await expect(
      service.createDecision(ACTIVITY_ID, MANAGER_ID, rejectInput),
    ).rejects.toBe(infraError);
  });
});
