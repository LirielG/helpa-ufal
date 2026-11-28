import type { ActivityStatus, UserActivityList } from "./types";

export interface EmptyStateConfig {
  text: string;
  buttonLabel: string;
  actionType: "navigate" | "register_modal";
  targetRoute?: string;
}

export const EMPTY_STATE_CONFIGS: Record<UserActivityList, EmptyStateConfig> = {
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
  certified: {
    text: "Você ainda não tem certificados emitidos.",
    buttonLabel: "Explorar ações",
    actionType: "navigate",
    targetRoute: "/dashboard",
  },
};

export const ACTIVITY_LIST_TITLES: Record<UserActivityList, string> = {
  enrolled: "Atividades Inscritas",
  completed: "Atividades Concluídas",
  managed: "Atividades Gerenciadas",
  certified: "Meus certificados",
};

const ACTIVITY_STATUSES: readonly string[] = [
  "enrolled",
  "completed",
  "managed",
] satisfies ActivityStatus[];

export const DEFAULT_ACTIVITY_STATUS: ActivityStatus = "enrolled";

export const isActivityStatus = (
  value: string | null,
): value is ActivityStatus =>
  value !== null && ACTIVITY_STATUSES.includes(value);
