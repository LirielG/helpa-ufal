export type ActionStatus = "available" | "full" | "upcoming";

export type ActionType = "oficina" | "palestra" | "evento" | "servico" | "minicurso";

export type ActionArea = "robotica" | "educacao" | "saude" | "meio_ambiente" | "arquitetura";

export type ActionFormat = "presencial" | "remoto" | "hibrido";

export interface Action {
  id: string;
  title: string;
  description: string;
  image: string;
  location: string;
  date: string;
  workload: number;
  format: string;
  spots: number;
  cep: number;
  city: string;
  state: string;
  type: ActionType;
  status: ActionStatus;
  area?: string;
}

export interface FilterOptions {
  area: string;
  actionType: string;
  availability: string;
}