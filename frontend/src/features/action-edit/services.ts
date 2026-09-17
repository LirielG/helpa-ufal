import { api } from "../../services/api";
import type { ActionEditSchemaType } from "./validators";

export async function updateAction(id: string, payload: Partial<ActionEditSchemaType>) {
  const response = (await api.patch(`/activities/${id}`, payload)) as {
    data: Record<string, unknown>;
  };
  return response.data;
}