import { describe, it, expect, vi } from "vitest";
import ActivityService from "../ActivityService.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import CustomError from "@/models/error/CustomError.js";

function mockRepository(
  overrides: Partial<IActivityRepository> = {},
): IActivityRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findUserById: vi.fn().mockResolvedValue({ isManager: false }),
    softDelete: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as IActivityRepository;
}

// Extrai e valida o erro esperado: tipo + status HTTP.
async function expectHttpError(
  promise: Promise<unknown>,
  status: number,
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(CustomError);
    expect((error as CustomError & { status: number }).status).toBe(status);
    return;
  }
  throw new Error(`Esperava CustomError com status ${status}, mas nada foi lançado.`);
}

describe("ActivityService.delete", () => {
  // ---------- Atividade Inexistente/Deletada ----------

  it("lança 404 quando a atividade não existe ou já foi deletada", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await expectHttpError(service.delete("act-1", "user-1"), 404);
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  it("lança 404 (e não 403) quando a atividade não existe, mesmo para quem não seria autor", async () => {
    // Existência é checada antes de permissão.
    // Isso mantém o comportamento simétrico ao GET (atividade deletada é invisível a todos).
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await expectHttpError(service.delete("act-1", "qualquer-um"), 404);
    expect(repository.findUserById).not.toHaveBeenCalled();
  });

  // ---------- Sem Autorização ----------

  it("lança 403 quando o solicitante não é autor nem gestor", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "author-1" }),
    });
    const service = new ActivityService({ activityRepository: repository });

    await expectHttpError(service.delete("act-1", "user-2"), 403);
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  it("lança 403 quando o usuário do token não existe mais no banco e não é o autor", async () => {
    // Cenário do "usuário fantasma": conta removida/desativada, token ainda válido.
    // Justifica o uso do "valor fresco" do banco em vez do claim do JWT.
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "author-1" }),
      findUserById: vi.fn().mockResolvedValue(null),
    });
    const service = new ActivityService({ activityRepository: repository });

    await expectHttpError(service.delete("act-1", "ghost-user"), 403);
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  // ---------- Caminho feliz ----------

  it("o autor consegue deletar a própria atividade", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "author-1" }),
    });
    const service = new ActivityService({ activityRepository: repository });

    await service.delete("act-1", "author-1");
    expect(repository.softDelete).toHaveBeenCalledTimes(1);
    expect(repository.softDelete).toHaveBeenCalledWith("act-1");
  });

  it("o autor consegue deletar mesmo que seu registro de usuário não seja encontrado", async () => {
    // A checagem de autor usa o authorId da atividade, não o registro do usuário.
    // Documenta que isAuthor independe de findUserById.
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "author-1" }),
      findUserById: vi.fn().mockResolvedValue(null),
    });
    const service = new ActivityService({ activityRepository: repository });

    await service.delete("act-1", "author-1");
    expect(repository.softDelete).toHaveBeenCalledTimes(1);
  });

  it("um gestor consegue deletar atividade de outro autor", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "author-1" }),
      findUserById: vi.fn().mockResolvedValue({ isManager: true }),
    });
    const service = new ActivityService({ activityRepository: repository });

    await service.delete("act-1", "manager-9");
    expect(repository.softDelete).toHaveBeenCalledWith("act-1");
  });

  it("um gestor consegue deletar a própria atividade", async () => {
    // Interseção das duas permissões: não pode falhar por ambiguidade na regra.
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "manager-9" }),
      findUserById: vi.fn().mockResolvedValue({ isManager: true }),
    });
    const service = new ActivityService({ activityRepository: repository });

    await service.delete("act-1", "manager-9");
    expect(repository.softDelete).toHaveBeenCalledTimes(1);
  });

  // ---------- Concorrência ----------

  it("não lança erro quando softDelete retorna false (outra requisição deletou primeiro)", async () => {
    // Race condition: findById viu a atividade ativa, mas entre a leitura e a
    // escrita outra requisição a deletou. 
    // O updateMany com guarda deletedAt:null retorna count 0 ⇒ softDelete retorna false. 
    // Se trata de um sucesso
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "author-1" }),
      softDelete: vi.fn().mockResolvedValue(false),
    });
    const service = new ActivityService({ activityRepository: repository });

    await expect(service.delete("act-1", "author-1")).resolves.toBeUndefined();
  });
});