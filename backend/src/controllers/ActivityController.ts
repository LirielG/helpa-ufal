import { Request, Response } from 'express';
import { ActivityService } from '../services/auth/ActivityService.js';

export class ActivityController {
  async list(req: Request, res: Response) {
    try {
      const service = new ActivityService();
      
      // Chama o serviço que busca no banco
      const activities = await service.listActivities();

      // Devolve o status 200 (OK) e a lista de atividades em formato JSON
      return res.status(200).json(activities);
      
    } catch (error) {
      // Se algo der errado no banco, não quebra o servidor
      console.error(error);
      return res.status(500).json({ message: 'Erro interno ao buscar as ações/atividades.' });
    }
  }
}