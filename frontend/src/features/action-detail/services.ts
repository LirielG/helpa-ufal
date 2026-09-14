import { api } from "../../services/api";
import type { ActionDetail } from "./types";

export async function getActionById(id: string): Promise<ActionDetail | null> {
  try {
    return await api.get<ActionDetail>(`/activities/${id}`);
  } catch (error) {
    console.error("Erro ao buscar detalhes da ação:", error);
    return null;
  }
}

export async function enrollInAction(actionId: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  void actionId;
}
