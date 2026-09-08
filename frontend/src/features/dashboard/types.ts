export type ActionType = "EXTENSION" | "COURSE" | "EVENT" | "LECTURE" | "OTHER";

export type ActionStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type ActionFormat = "IN_PERSON" | "ONLINE" | "HYBRID";

export type ActionCampus =
  | "MACEIO"
  | "ARAPIRACA"
  | "PALMEIRA"
  | "PENEDO"
  | "RIO_LARGO"
  | "DELMIRO_GOUVEIA"
  | "SANTANA_IPANEMA";

export interface ActionDetails {
  description: string;
  area: string;
  format: ActionFormat;
  url: string | null;
  workloadHours: number;
}

export interface Action {
  id: string;
  authorId: string;
  title: string;
  type: ActionType;
  campus: ActionCampus;
  startDate: string;
  endDate: string;
  slots: number;
  availableSlots: number;
  status: ActionStatus;
  details: ActionDetails | null;
}

export interface FilterOptions {
  area: string;
  actionType: string;
  availability: string;
  search?: string;
}

export interface PaginatedResponse<T> {
  activities: T[];
  total: number;
}
