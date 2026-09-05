import { api } from "../../services/api";
import type { ActionDetail } from "./types";

export async function getActionById(id: string): Promise<ActionDetail | null> {
  try {
    const response = await api.get(`/activities/${id}`);
    return response as ActionDetail;
  } catch (error) {
    console.error("Erro ao buscar detalhes da ação:", error);
    return null; 
  }
}

export async function enrollInAction(actionId: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1000));
    void actionId;
}