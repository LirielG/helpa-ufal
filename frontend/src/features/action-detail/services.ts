import { api } from "../../services/api";
import type { Activity } from "@/services/contracts/activity";

export async function getActionById(id: string): Promise<Activity | null> {
  try {
    return await api.get<Activity>(`/activities/${id}`);
  } catch (error) {
    console.error("Erro ao buscar detalhes da ação:", error);
    return null;
  }
}

export async function enrollInAction(actionId: string): Promise<void> {
  await api.post<void>(`/activities/${actionId}/enroll`);
}
