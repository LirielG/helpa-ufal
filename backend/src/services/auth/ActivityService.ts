import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ActivityService {
  async listActivities() {
    // Busca todas as atividades no banco de dados.
    // O Prisma automaticamente transforma "Activity" em "activity".
    const activities = await prisma.activity.findMany({
      // Se quiser, pode incluir os detalhes da atividade na mesma busca!
      include: {
        details: true,
        author: {
          select: { fullName: true } // Traz apenas o nome do autor
        }
      }
    });

    return activities;
  }
}