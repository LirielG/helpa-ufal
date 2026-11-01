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

export const PROFILE_SUB_TABS: Array<{ id: ActivityStatus; label: string }> = [
  { id: "enrolled", label: "Atividades Inscritas" },
  { id: "completed", label: "Atividades Concluídas" },
  { id: "managed", label: "Atividades Gerenciadas" },
];
