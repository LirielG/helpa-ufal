export type ActionStatus = "available" | "full" | "upcoming";

export type ActionType = "oficina" | "palestra" | "evento" | "servico";

export interface Action {
  id: string;
  title: string;
  description: string;
  image: string;
  location: string;
  date: string;
  spots: number;
  type: ActionType;
  status: ActionStatus;
  area?: string;
}

export interface FilterOptions {
  area: string;
  actionType: string;
  availability: string;
}