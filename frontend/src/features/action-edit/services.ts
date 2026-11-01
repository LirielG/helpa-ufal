import { api } from "../../services/api";
import type { Activity } from "@/services/contracts/activity";
import type { UpdateActionPayload } from "./types";

export function updateAction(
  id: string,
  payload: UpdateActionPayload,
): Promise<Activity> {
  return api.patch<Activity>(`/activities/${id}`, payload);
}
