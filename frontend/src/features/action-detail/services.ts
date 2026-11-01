import { api } from "../../services/api";
import type { Activity } from "@/services/contracts/activity";

export async function getActionById(id: string): Promise<Activity> {
  return api.get<Activity>(`/activities/${id}`);
}

export async function enrollInAction(actionId: string): Promise<void> {
  await api.post<void>(`/activities/${actionId}/enroll`);
}

export async function cancelEnrollment(actionId: string): Promise<void> {
  await api.delete<void>(`/activities/${actionId}/enroll`);
}
