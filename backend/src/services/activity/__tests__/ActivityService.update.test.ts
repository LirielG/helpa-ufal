import { describe, it, expect, vi } from "vitest";
import ActivityService from "../ActivityService.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import ValidationError from "@/models/error/ValidationError.js";
import { expectHttpError } from "@/utils/tests.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

const ADDRESS = {
  addressLine: "Av. Manoel Severino Barbosa, s/n",
  district: "Bom Sucesso",
  zipCode: "57309005",
  city: "Arapiraca",
  state: "AL",
} as const;

const AUTHOR = { id: "author-1", isManager: false };
const MANAGER = { id: "manager-9", isManager: true };
const THIRD_PARTY = { id: "user-2", isManager: false };

type StoredDetails = {
  workloadHours: number;
  format: string;
  url?: string;
  address?: typeof ADDRESS | null;
};

type StoredActivity = {
  id: string;
  authorId: string;
  status: string;
  startDate: Date;
  endDate: Date;
  slots: number;
  availableSlots: number;
  details: StoredDetails | null;
};

function makeActivity(overrides: Partial<StoredActivity> = {}): StoredActivity {
  const { details, ...rest } = overrides;
  return {
    id: "act-1",
    authorId: "author-1",
    status: "OPEN",
    startDate: daysFromNow(10),
    endDate: daysFromNow(12),
    slots: 40,
    availableSlots: 40,
    details:
      details === undefined
        ? { workloadHours: 8, format: "IN_PERSON", address: ADDRESS }
        : details,
    ...rest,
  };
}

// O dublê do update expõe APENAS findById e update: o método não consulta o
// usuário no banco. Essa ausência é proposital — faz parte do teste do
// usuário fantasma (ver TODO(#148) na seção de autorização).
function mockRepository(
  overrides: Partial<IActivityRepository> = {},
): IActivityRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    update: vi
      .fn()
      .mockImplementation((id: string, data: object) =>
        Promise.resolve({ id, ...data }),
      ),
    ...overrides,
  } as unknown as IActivityRepository;
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject, but it resolved.");
}

describe("ActivityService.update", () => {
  // ---------- Activity lookup ----------

  it("throws 404 when the activity does not exist or was deleted", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await expectHttpError(
      service.update("act-1", AUTHOR, { title: "x" }),
      404,
      "Activity not found.",
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  // ---------- Authorization ----------

  it("throws 403 when the requester is neither the author nor a manager", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivity()),
    });
    const service = new ActivityService({ activityRepository: repository });

    await expectHttpError(
      service.update("act-1", THIRD_PARTY, { title: "x" }),
      403,
      "You do not have permission to update this activity.",
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("throws 403 (not 409) when a third party targets a completed activity", async () => {
    // Fixa a ordem das guardas: autorização vem antes da checagem de status.
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivity({ status: "COMPLETED" })),
    });
    const service = new ActivityService({ activityRepository: repository });

    await expectHttpError(service.update("act-1", THIRD_PARTY, { title: "x" }), 403);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("allows a deleted user with a valid token to update (defect pinned until #148)", async () => {
    // TODO(#148): o update deriva isAuthor/isManager apenas do token e nunca
    // consulta o usuário no banco — um usuário apagado com JWT válido autoriza.
    // Quando a #148 for resolvida, este caso deve lançar 403 e o dublê passará
    // a expor findUserById. Este teste deve falhar de propósito nesse momento.
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivity()),
    });
    const service = new ActivityService({ activityRepository: repository });

    await service.update("act-1", AUTHOR, { title: "Novo título" });

    expect(repository.update).toHaveBeenCalledTimes(1);
  });

  // ---------- Status guard ----------

  it("throws 409 when the activity is COMPLETED", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivity({ status: "COMPLETED" })),
    });
    const service = new ActivityService({ activityRepository: repository });

    await expectHttpError(
      service.update("act-1", AUTHOR, { title: "x" }),
      409,
      "Activity cannot be updated because it is already COMPLETED.",
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("throws 409 when the activity is CANCELLED", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivity({ status: "CANCELLED" })),
    });
    const service = new ActivityService({ activityRepository: repository });

    await expectHttpError(
      service.update("act-1", AUTHOR, { title: "x" }),
      409,
      "Activity cannot be updated because it is already CANCELLED.",
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  // ---------- Happy path ----------

  it("the author can update their own activity", async () => {
    const stored = makeActivity();
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(stored),
      update: vi.fn().mockResolvedValue(stored),
    });
    const service = new ActivityService({ activityRepository: repository });

    const result = await service.update("act-1", AUTHOR, {
      title: "Oficina de Introdução à Programação — Turma 2",
      slots: 50,
    });

    expect(repository.update).toHaveBeenCalledWith(
      "act-1",
      { title: "Oficina de Introdução à Programação — Turma 2", slots: 50 },
      "NONE",
    );
    // Hoje o service repassa o retorno do repositório sem montar um DTO
    // explícito (diferente de create/updateStatus). Fixado propositalmente;
    // a issue de DTO do update deve reverter esta asserção.
    expect(result).toBe(stored);
  });

  it("a manager can update another author's activity", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivity()),
    });
    const service = new ActivityService({ activityRepository: repository });

    await service.update("act-1", MANAGER, { title: "Editado pelo gestor" });

    expect(repository.update).toHaveBeenCalledTimes(1);
  });

  it("a manager can update their own activity", async () => {
    // Interseção das duas permissões: a regra não pode ser ambígua aqui.
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivity({ authorId: "manager-9" })),
    });
    const service = new ActivityService({ activityRepository: repository });

    await service.update("act-1", MANAGER, { title: "Minha própria ação" });

    expect(repository.update).toHaveBeenCalledTimes(1);
  });

  // ---------- Partial updates ----------

  it("forwards only the sent fields to the repository", async () => {
    // Semântica de PATCH: o service valida com valores fundidos, mas persiste
    // apenas o que veio no payload; preservar o restante é papel do repositório.
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivity()),
    });
    const service = new ActivityService({ activityRepository: repository });

    await service.update("act-1", AUTHOR, { title: "Só título" });

    expect(repository.update).toHaveBeenCalledWith(
      "act-1",
      { title: "Só título" },
      "NONE",
    );
  });

  it("skips date validation when no date is sent, even with a past startDate", async () => {
    // A validação de datas só roda se startDate ou endDate vierem no payload —
    // editar o título de uma ação cuja data já passou deve continuar possível.
    const repository = mockRepository({
      findById: vi
        .fn()
        .mockResolvedValue(
          makeActivity({ startDate: daysFromNow(-5), endDate: daysFromNow(-3) }),
        ),
    });
    const service = new ActivityService({ activityRepository: repository });

    await service.update("act-1", AUTHOR, { title: "Ação antiga" });

    expect(repository.update).toHaveBeenCalledTimes(1);
  });

  // ---------- Date validation ----------

  it("rejects a past startDate with ValidationError on startDate", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivity()),
    });
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureError(
      service.update("act-1", AUTHOR, { startDate: daysFromNow(-1) }),
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual([
      { field: "startDate", message: "startDate must be in the future." },
    ]);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("rejects an endDate earlier than the merged startDate", async () => {
    // Só endDate no payload: a comparação usa o startDate já salvo (merge).
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivity()),
    });
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureError(
      service.update("act-1", AUTHOR, { endDate: daysFromNow(5) }),
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual([
      { field: "endDate", message: "endDate must be after startDate." },
    ]);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("accepts valid dates and forwards them to the repository", async () => {
    const startDate = daysFromNow(20);
    const endDate = daysFromNow(22);
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivity()),
    });
    const service = new ActivityService({ activityRepository: repository });

    await service.update("act-1", AUTHOR, { startDate, endDate });

    expect(repository.update).toHaveBeenCalledWith(
      "act-1",
      { startDate, endDate },
      "NONE",
    );
  });

  // ---------- Slots and workload ----------

  it("rejects slots below the number of approved enrollments", async () => {
    // approved = slots - availableSlots = 40 - 27 = 13.
    const repository = mockRepository({
      findById: vi
        .fn()
        .mockResolvedValue(makeActivity({ slots: 40, availableSlots: 27 })),
    });
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureError(service.update("act-1", AUTHOR, { slots: 10 }));

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual([
      {
        field: "slots",
        message:
          "slots cannot be reduced below the current number of approved enrollments (13).",
      },
    ]);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("rejects slots above the maximum", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivity()),
    });
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureError(
      service.update("act-1", AUTHOR, { slots: 10_001 }),
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual([
      { field: "slots", message: "slots cannot exceed 10000." },
    ]);
  });

  it("rejects workloadHours above the activity duration", async () => {
    // Ação padrão dura 2 dias (48h); 100h excede a duração total.
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivity()),
    });
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureError(
      service.update("act-1", AUTHOR, { workloadHours: 100 }),
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual([
      {
        field: "workloadHours",
        message: "workloadHours cannot exceed the total duration of the activity.",
      },
    ]);
    expect(repository.update).not.toHaveBeenCalled();
  });

  // ---------- Format, url and address ----------

  it("rejects ONLINE when no url is sent and none is stored", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivity()), // IN_PERSON salvo, sem url
    });
    const service = new ActivityService({ activityRepository: repository });

    await expectHttpError(
      service.update("act-1", AUTHOR, { format: "ONLINE" }),
      400,
      "ONLINE activities require a url.",
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("accepts ONLINE using the stored url and schedules address deletion", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(
        makeActivity({
          details: {
            workloadHours: 8,
            format: "HYBRID",
            url: "https://meet.example.com/turma2",
            address: ADDRESS,
          },
        }),
      ),
    });
    const service = new ActivityService({ activityRepository: repository });

    await service.update("act-1", AUTHOR, { format: "ONLINE" });

    // A asserção fica no addressAction (canal explícito). O service hoje também
    // zera data.address por mutação — cheiro conhecido, não fixado aqui.
    expect(repository.update).toHaveBeenCalledWith(
      "act-1",
      expect.objectContaining({ format: "ONLINE" }),
      "DELETE",
    );
  });

  it("accepts IN_PERSON using the stored address (no address in payload)", async () => {
    // Semântica do service: o estado fundido (patch + banco) já satisfaz a
    // regra. ATENÇÃO: o superRefine do UpdateActivitySchema hoje barra esse
    // payload no controller antes do service — divergência Zod × service que
    // será tratada em issue própria. Este teste fixa a semântica do service.
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(
        makeActivity({
          details: {
            workloadHours: 8,
            format: "HYBRID",
            url: "https://meet.example.com/turma2",
            address: ADDRESS,
          },
        }),
      ),
    });
    const service = new ActivityService({ activityRepository: repository });

    await service.update("act-1", AUTHOR, { format: "IN_PERSON" });

    expect(repository.update).toHaveBeenCalledWith(
      "act-1",
      { format: "IN_PERSON" },
      "NONE",
    );
  });

  it("rejects IN_PERSON when no address exists and none is sent", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(
        makeActivity({
          details: {
            workloadHours: 8,
            format: "ONLINE",
            url: "https://meet.example.com/turma2",
            address: null,
          },
        }),
      ),
    });
    const service = new ActivityService({ activityRepository: repository });

    await expectHttpError(
      service.update("act-1", AUTHOR, { format: "IN_PERSON" }),
      400,
      "IN_PERSON activities require an address.",
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("rejects HYBRID when no address exists and none is sent", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(
        makeActivity({
          details: {
            workloadHours: 8,
            format: "ONLINE",
            url: "https://meet.example.com/turma2",
            address: null,
          },
        }),
      ),
    });
    const service = new ActivityService({ activityRepository: repository });

    await expectHttpError(
      service.update("act-1", AUTHOR, { format: "HYBRID" }),
      400,
      "HYBRID activities require an address.",
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("schedules address update when only a new address is sent", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivity()), // IN_PERSON com endereço
    });
    const service = new ActivityService({ activityRepository: repository });

    await service.update("act-1", AUTHOR, {
      address: { ...ADDRESS, district: "Centro" },
    });

    expect(repository.update).toHaveBeenCalledWith(
      "act-1",
      { address: { ...ADDRESS, district: "Centro" } },
      "UPDATE",
    );
  });

  it("schedules address creation when the new format requires one", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(
        makeActivity({
          details: {
            workloadHours: 8,
            format: "ONLINE",
            url: "https://meet.example.com/turma2",
            address: null,
          },
        }),
      ),
    });
    const service = new ActivityService({ activityRepository: repository });

    await service.update("act-1", AUTHOR, { format: "IN_PERSON", address: ADDRESS });

    expect(repository.update).toHaveBeenCalledWith(
      "act-1",
      { format: "IN_PERSON", address: ADDRESS },
      "CREATE",
    );
  });

  it("drops a sent address when the activity is ONLINE", async () => {
    // ONLINE não tem endereço: o service descarta o que veio no payload e não
    // agenda nada (não há endereço salvo para remover).
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(
        makeActivity({
          details: {
            workloadHours: 8,
            format: "ONLINE",
            url: "https://meet.example.com/turma2",
            address: null,
          },
        }),
      ),
    });
    const service = new ActivityService({ activityRepository: repository });

    await service.update("act-1", AUTHOR, { address: ADDRESS });

    expect(repository.update).toHaveBeenCalledWith(
      "act-1",
      expect.objectContaining({ address: null }),
      "NONE",
    );
  });
});
