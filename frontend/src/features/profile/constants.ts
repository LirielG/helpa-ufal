import type { ActivityStatus } from "./types";

export interface EmptyStateConfig {
  text: string;
  buttonLabel: string;
  actionType: "navigate" | "register_modal";
  targetRoute?: string;
}

export const EMPTY_STATE_CONFIGS: Record<ActivityStatus, EmptyStateConfig> = {
  enrolled: {
    text: "Você não está inscrito em nenhuma ação no momento.",
    buttonLabel: "Explorar ações",
    actionType: "navigate",
    targetRoute: "/dashboard",
  },
  completed: {
    text: "Você ainda não concluiu nenhuma ação.",
    buttonLabel: "Explorar ações",
    actionType: "navigate",
    targetRoute: "/dashboard",
  },
  managed: {
    text: "Você ainda não criou nenhuma ação.",
    buttonLabel: "Criar uma ação",
    actionType: "register_modal",
  },
};

export const ACTIVITY_LIST_TITLES: Record<ActivityStatus, string> = {
  enrolled: "Atividades Inscritas",
  completed: "Atividades Concluídas",
  managed: "Atividades Gerenciadas",
};

export const DEFAULT_ACTIVITY_STATUS: ActivityStatus = "enrolled";

export const isActivityStatus = (
  value: string | null,
): value is ActivityStatus =>
  value !== null && Object.hasOwn(ACTIVITY_LIST_TITLES, value);
