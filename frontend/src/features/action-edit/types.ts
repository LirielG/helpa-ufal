import type { ActionType } from "../dashboard/types";

export interface ActionEditFormData {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  type: ActionType;
  spots: number;
}

export interface Responsible {
  name: string;
  email: string;
  avatarUrl?: string;
}