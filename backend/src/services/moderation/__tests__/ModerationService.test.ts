import { afterEach, describe, expect, it, vi } from "vitest";
import ModerationService from "../ModerationService.js";
import type {
  ActivityModerationState,
  CreatedModerationDecision,
  IModerationRepository,
  ModerationDecisionNotifications,
} from "@/repositories/moderation/IModerationRepository.js";
import EmailService from "@/services/email/EmailService.js";
import type {
  EmailMessage,
  IEmailTransport,
} from "@/services/email/transport/IEmailTransport.js";
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
const ACTIVITY_TITLE = "Oficina de Introdução à Programação";
const AUTHOR_ID = "a1b2c3d4-0000-4000-8000-000000000099";
const MANAGER_ID = "a1b2c3d4-0000-4000-8000-000000000001";
const REPORTER_ID = "a1b2c3d4-0000-4000-8000-000000000042";
const REPORTER_ID_2 = "a1b2c3d4-0000-4000-8000-000000000043";
const DECISION_ID = "c3d4e5f6-0000-4000-8000-000000000010";
const REPORT_ID = "b2c3d4e5-0000-4000-8000-000000000007";
const REPORT_ID_2 = "b2c3d4e5-0000-4000-8000-000000000008";
const REPORT_ID_3 = "b2c3d4e5-0000-4000-8000-000000000009";
const CREATED_AT = new Date("2026-06-05T19:44:20.000Z");
const DECIDED_AT = new Date("2026-06-10T12:00:00.000Z");

const AUTHOR_EMAIL = "autor@helpa.test";
const REPORTER_1_EMAIL = "denunciante1@helpa.test";
const REPORTER_2_EMAIL = "denunciante2@helpa.test";
const ENROLLEE_1_EMAIL = "inscrito1@helpa.test";
const ENROLLEE_2_EMAIL = "inscrito2@helpa.test";

afterEach(() => {
  vi.restoreAllMocks();
});

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
    openReportIds: [REPORT_ID, REPORT_ID_2],
    ...overrides,
  };
}

function aNotificationSet(
  overrides: Partial<ModerationDecisionNotifications> = {},
): ModerationDecisionNotifications {
  return {
    activityTitle: ACTIVITY_TITLE,
    authorEmail: AUTHOR_EMAIL,
    reporterEmails: [REPORTER_1_EMAIL, REPORTER_2_EMAIL],
    cancelledEnrolleeEmails: [],
    ...overrides,
  };
}

function setup({
  page = { items: [aReportedActivity()], total: 1 },
  activityState = anActivityState(),
  createdDecision = aDecision(),
  notifications = aNotificationSet(),
  transportSend,
}: {
  page?: { items: ReportedActivityItem[]; total: number };
  activityState?: ActivityModerationState | null;
  createdDecision?: ModerationDecisionResponse;
  notifications?: ModerationDecisionNotifications;
  transportSend?: IEmailTransport["send"];
} = {}) {
  const sentEmails: EmailMessage[] = [];
  const defaultSend: IEmailTransport["send"] = async (message) => {
    sentEmails.push(message);
  };
  const transport: IEmailTransport = {
    send: vi.fn(transportSend ?? defaultSend),
  };
  const emailService = new EmailService({ transport });

  const createdResult: CreatedModerationDecision = {
    decision: createdDecision,
    notifications,
  };

  const moderationRepository: IModerationRepository = {
    listReportedActivities: vi.fn().mockResolvedValue(page),
    findActivityForModeration: vi.fn().mockResolvedValue(activityState),
    createDecision: vi.fn().mockResolvedValue(createdResult),
  };

  const service = new ModerationService({ moderationRepository, emailService });

  return { service, moderationRepository, emailService, transport, sentEmails };
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
    reportIds: [REPORT_ID, REPORT_ID_2],
  };
  const upholdInput: CreateModerationDecisionInput = {
    verdict: "UPHELD",
    justification: "Ação viola diretrizes da plataforma.",
    reportIds: [REPORT_ID, REPORT_ID_2],
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

  it("accepts matching reportIds regardless of order", async () => {
    const createdDecision = aDecision();
    const { service, moderationRepository } = setup({ createdDecision });
    const reversedInput: CreateModerationDecisionInput = {
      ...rejectInput,
      reportIds: [REPORT_ID_2, REPORT_ID],
    };

    const response = await service.createDecision(
      ACTIVITY_ID,
      MANAGER_ID,
      reversedInput,
    );

    expect(moderationRepository.createDecision).toHaveBeenCalledWith(
      ACTIVITY_ID,
      MANAGER_ID,
      reversedInput,
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
        openReportIds: [],
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
      activityState: anActivityState({ openReportIds: [] }),
    });

    await expectHttpError(
      service.createDecision(ACTIVITY_ID, MANAGER_ID, rejectInput),
      409,
      "Activity has no open reports.",
      "NO_OPEN_REPORTS",
    );
    expect(moderationRepository.createDecision).not.toHaveBeenCalled();
  });

  it("prioritizes 409 NO_OPEN_REPORTS over 409 REPORTS_CHANGED and 409 ACTIVITY_COMPLETED", async () => {
    const { service, moderationRepository } = setup({
      activityState: anActivityState({
        status: "COMPLETED",
        openReportIds: [],
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

  it.each([
    { label: "subset (missing a new report)", reportIds: [REPORT_ID] },
    {
      label: "superset (includes an extra report ID)",
      reportIds: [REPORT_ID, REPORT_ID_2, REPORT_ID_3],
    },
    {
      label: "same size with a different ID",
      reportIds: [REPORT_ID, REPORT_ID_3],
    },
  ])(
    "throws 409 REPORTS_CHANGED when reportIds is a $label",
    async ({ reportIds }) => {
      const { service, moderationRepository } = setup();

      await expectHttpError(
        service.createDecision(ACTIVITY_ID, MANAGER_ID, {
          ...rejectInput,
          reportIds,
        }),
        409,
        "Open reports changed since the queue was loaded.",
        "REPORTS_CHANGED",
      );
      expect(moderationRepository.createDecision).not.toHaveBeenCalled();
    },
  );

  it("prioritizes 409 REPORTS_CHANGED over 409 ACTIVITY_COMPLETED", async () => {
    const { service, moderationRepository } = setup({
      activityState: anActivityState({
        status: "COMPLETED",
        openReportIds: [REPORT_ID, REPORT_ID_2],
      }),
    });

    await expectHttpError(
      service.createDecision(ACTIVITY_ID, MANAGER_ID, {
        ...upholdInput,
        reportIds: [REPORT_ID],
      }),
      409,
      "Open reports changed since the queue was loaded.",
      "REPORTS_CHANGED",
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

  it("propagates repository errors unchanged without sending any email", async () => {
    const infraError = new Error("database unavailable");
    const { service, moderationRepository, transport } = setup();
    vi.mocked(moderationRepository.createDecision).mockRejectedValueOnce(
      infraError,
    );

    await expect(
      service.createDecision(ACTIVITY_ID, MANAGER_ID, rejectInput),
    ).rejects.toBe(infraError);
    expect(transport.send).not.toHaveBeenCalled();
  });

  // ---------- Post-commit notification emails (#445) ----------

  it("sends emails to reporters, author (with justification), and cancelled enrollees (without justification) on UPHELD", async () => {
    const createdDecision = aDecision({
      verdict: "UPHELD",
      justification: "Ação viola diretrizes da plataforma.",
      reports: [
        {
          id: REPORT_ID,
          category: "SPAM",
          description: "Repeated promotional content.",
          createdAt: CREATED_AT,
          reporter: { id: REPORTER_ID, fullName: "Maria Clara Santos" },
        },
        {
          id: REPORT_ID_2,
          category: "INAPPROPRIATE_CONTENT",
          description: "Conteúdo ofensivo.",
          createdAt: CREATED_AT,
          reporter: { id: REPORTER_ID_2, fullName: "João Pedro Lima" },
        },
      ],
    });

    const { service, sentEmails } = setup({
      createdDecision,
      notifications: aNotificationSet({
        authorEmail: AUTHOR_EMAIL,
        reporterEmails: [REPORTER_1_EMAIL, REPORTER_2_EMAIL],
        cancelledEnrolleeEmails: [ENROLLEE_1_EMAIL, ENROLLEE_2_EMAIL],
      }),
    });

    const response = await service.createDecision(
      ACTIVITY_ID,
      MANAGER_ID,
      upholdInput,
    );

    expect(response).toBe(createdDecision);
    expect(sentEmails).toHaveLength(5);

    const byRecipient = new Map(sentEmails.map((email) => [email.to, email]));

    for (const reporterEmail of [REPORTER_1_EMAIL, REPORTER_2_EMAIL]) {
      const msg = byRecipient.get(reporterEmail);
      expect(msg).toBeDefined();
      expect(msg?.subject).toBe("Sua denúncia foi analisada");
      expect(msg?.text).toContain(
        `A ação «${ACTIVITY_TITLE}», que você denunciou, foi analisada pela moderação e removida da plataforma.`,
      );
      expect(msg?.text).toContain(
        "A decisão considera o conjunto das denúncias recebidas e a análise da moderação, e não indica necessariamente que a remoção aconteceu pelo motivo que você apontou.",
      );
      expect(msg?.text).not.toContain(createdDecision.justification);
    }

    const authorMsg = byRecipient.get(AUTHOR_EMAIL);
    expect(authorMsg).toBeDefined();
    expect(authorMsg?.subject).toBe("Sua ação foi removida pela moderação");
    expect(authorMsg?.text).toContain(
      `A ação «${ACTIVITY_TITLE}» foi removida pela moderação do Helpa.`,
    );
    expect(authorMsg?.text).toContain(
      `Justificativa: ${createdDecision.justification}`,
    );
    expect(authorMsg?.text).toContain(
      "As inscrições ativas foram canceladas. Certificados já emitidos continuam válidos.",
    );

    for (const enrolleeEmail of [ENROLLEE_1_EMAIL, ENROLLEE_2_EMAIL]) {
      const msg = byRecipient.get(enrolleeEmail);
      expect(msg).toBeDefined();
      expect(msg?.subject).toBe("Ação removida e inscrição cancelada");
      expect(msg?.text).toContain(
        `A ação «${ACTIVITY_TITLE}», em que você tinha inscrição, foi removida pela moderação do Helpa, e sua inscrição foi cancelada.`,
      );
      expect(msg?.text).not.toContain(createdDecision.justification);
      expect(msg?.html).not.toContain(createdDecision.justification);
    }
  });

  it("sends only reporter emails with the published copy on REJECTED", async () => {
    const createdDecision = aDecision({
      verdict: "REJECTED",
      justification: "Denúncia improcedente.",
    });

    const { service, sentEmails } = setup({
      createdDecision,
      notifications: aNotificationSet({
        authorEmail: AUTHOR_EMAIL,
        reporterEmails: [REPORTER_1_EMAIL, REPORTER_2_EMAIL],
        cancelledEnrolleeEmails: [ENROLLEE_1_EMAIL],
      }),
    });

    await service.createDecision(ACTIVITY_ID, MANAGER_ID, rejectInput);

    expect(sentEmails).toHaveLength(2);
    expect(sentEmails.map((email) => email.to)).toEqual([
      REPORTER_1_EMAIL,
      REPORTER_2_EMAIL,
    ]);

    for (const msg of sentEmails) {
      expect(msg.subject).toBe("Sua denúncia foi analisada");
      expect(msg.text).toContain(
        `A ação «${ACTIVITY_TITLE}», que você denunciou, foi analisada pela moderação e continua publicada.`,
      );
      expect(msg.text).toContain(
        "A decisão considera o conjunto das denúncias recebidas e a análise da moderação, e não indica necessariamente que o motivo que você apontou foi descartado.",
      );
      expect(msg.text).not.toContain(createdDecision.justification);
    }
  });

  it.each(["UPHELD", "REJECTED"] as const)(
    "never includes manager name, reporter names, or report reasons in any %s email",
    async (verdict) => {
      const createdDecision = aDecision({
        verdict,
        decidedBy: { id: MANAGER_ID, fullName: "Gestora Confidencial" },
        justification: "Análise concluída pela equipe.",
        reports: [
          {
            id: REPORT_ID,
            category: "SPAM",
            description: "Anúncio repetido de curso pago.",
            createdAt: CREATED_AT,
            reporter: { id: REPORTER_ID, fullName: "Maria Clara Santos" },
          },
          {
            id: REPORT_ID_2,
            category: "INAPPROPRIATE_CONTENT",
            description: "Linguagem inadequada.",
            createdAt: CREATED_AT,
            reporter: { id: REPORTER_ID_2, fullName: "João Pedro Lima" },
          },
        ],
      });

      const { service, sentEmails } = setup({
        createdDecision,
        notifications: aNotificationSet({
          authorEmail: AUTHOR_EMAIL,
          reporterEmails: [REPORTER_1_EMAIL, REPORTER_2_EMAIL],
          cancelledEnrolleeEmails:
            verdict === "UPHELD" ? [ENROLLEE_1_EMAIL] : [],
        }),
      });

      await service.createDecision(
        ACTIVITY_ID,
        MANAGER_ID,
        verdict === "UPHELD" ? upholdInput : rejectInput,
      );

      expect(sentEmails.length).toBeGreaterThan(0);

      const forbiddenTokens = [
        "Gestora Confidencial",
        "Maria Clara Santos",
        "João Pedro Lima",
        "SPAM",
        "spam",
        "INAPPROPRIATE_CONTENT",
        "Anúncio repetido de curso pago.",
        "Linguagem inadequada.",
      ];

      for (const msg of sentEmails) {
        const payload = `${msg.subject}\n${msg.text}\n${msg.html}`;
        for (const token of forbiddenTokens) {
          expect(payload).not.toContain(token);
        }
      }
    },
  );

  it("ignores deleted accounts when author or reporters have no email", async () => {
    const createdDecision = aDecision({ verdict: "UPHELD" });
    const { service, sentEmails } = setup({
      createdDecision,
      notifications: aNotificationSet({
        authorEmail: null,
        reporterEmails: [],
        cancelledEnrolleeEmails: [ENROLLEE_1_EMAIL],
      }),
    });

    await service.createDecision(ACTIVITY_ID, MANAGER_ID, upholdInput);

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]?.to).toBe(ENROLLEE_1_EMAIL);
  });

  it("only dispatches emails after the repository commits the decision", async () => {
    const events: string[] = [];
    const createdDecision = aDecision({ verdict: "REJECTED" });
    const { service, moderationRepository } = setup({
      createdDecision,
      notifications: aNotificationSet({
        reporterEmails: [REPORTER_1_EMAIL],
      }),
      transportSend: async () => {
        events.push("email:send");
      },
    });

    vi.mocked(moderationRepository.createDecision).mockImplementationOnce(
      async () => {
        events.push("repo:commit");
        return {
          decision: createdDecision,
          notifications: aNotificationSet({
            reporterEmails: [REPORTER_1_EMAIL],
          }),
        };
      },
    );

    await service.createDecision(ACTIVITY_ID, MANAGER_ID, rejectInput);

    expect(events).toEqual(["repo:commit", "email:send"]);
  });

  it("logs delivery failures and still notifies other recipients and returns the committed decision", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const deliveryError = new Error("SMTP timeout");
    const createdDecision = aDecision({ verdict: "UPHELD" });
    const deliveredTo: string[] = [];

    const { service } = setup({
      createdDecision,
      notifications: aNotificationSet({
        authorEmail: AUTHOR_EMAIL,
        reporterEmails: [REPORTER_1_EMAIL, REPORTER_2_EMAIL],
        cancelledEnrolleeEmails: [ENROLLEE_1_EMAIL],
      }),
      transportSend: async (message) => {
        if (message.to === REPORTER_1_EMAIL) {
          throw deliveryError;
        }
        deliveredTo.push(message.to);
      },
    });

    const response = await service.createDecision(
      ACTIVITY_ID,
      MANAGER_ID,
      upholdInput,
    );

    expect(response).toBe(createdDecision);
    expect(deliveredTo.sort()).toEqual(
      [REPORTER_2_EMAIL, AUTHOR_EMAIL, ENROLLEE_1_EMAIL].sort(),
    );
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(DECISION_ID),
      deliveryError,
    );
  });

  it("does not send any email when fast-path validation fails", async () => {
    const { service, transport } = setup({ activityState: null });

    await expectHttpError(
      service.createDecision(ACTIVITY_ID, MANAGER_ID, rejectInput),
      404,
      "Activity not found.",
      "ACTIVITY_NOT_FOUND",
    );
    expect(transport.send).not.toHaveBeenCalled();
  });
});
