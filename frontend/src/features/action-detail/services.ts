import { api } from "../../services/api";
import type { Activity } from "@/services/contracts/activity";
import type { Enrollment } from "@/services/contracts/enrollment";

export async function getActionById(id: string): Promise<Activity> {
  return api.get<Activity>(`/activities/${id}`);
}

export async function enrollInAction(actionId: string): Promise<void> {
  await api.put<Enrollment>(`/activities/${actionId}/enrollments/me`);
}

export async function cancelEnrollment(actionId: string): Promise<void> {
  await api.delete<void>(`/activities/${actionId}/enrollments/me`);
}
