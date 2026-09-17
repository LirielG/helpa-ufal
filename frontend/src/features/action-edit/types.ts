import type { ActionType } from "../dashboard/types";

export interface ActionEditFormData {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  type: ActionType;
  slots: number;
  format: "IN_PERSON" | "ONLINE" | "HYBRID";
  workloadHours?: number;
  area: string;
  url?: string;
  campus: string;
  address?: {
    address: string;
    district: string;
    city: string;
    state: string;
    zipCode: string;
  };
}