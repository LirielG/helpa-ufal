import { api } from "../../services/api";
import type { ActionDetail } from "../action-detail/types";
import type { UpdateActionPayload } from "./types";

export function updateAction(
  id: string,
  payload: UpdateActionPayload,
): Promise<ActionDetail> {
  return api.patch<ActionDetail>(`/activities/${id}`, payload);
}
