import type {
  CampusLocation,
  ActivityFormat,
  ActivityType,
  ActivityStatus,
} from "@/services/contracts/activity";

/*** `area` is free text in the API and is rendered as-is on the action detail,
 * so the stored value is the label itself.
 */
export const ACTION_TYPE_LABELS: Record<ActivityType, string> = {
  EXTENSION: "Ação de extensão",
  COURSE: "Curso ou minicurso",
  EVENT: "Evento",
  LECTURE: "Palestra",
  OTHER: "Outro",
};

export const ACTION_FORMAT_LABELS: Record<ActivityFormat, string> = {
  IN_PERSON: "Presencial",
  ONLINE: "On-line",
  HYBRID: "Híbrido",
};

export const ACTION_CAMPUS_LABELS: Record<CampusLocation, string> = {
  MACEIO: "UFAL - Campus Maceió",
  ARAPIRACA: "UFAL - Campus Arapiraca",
  PALMEIRA: "UFAL - Campus Palmeira dos Índios",
  PENEDO: "UFAL - Campus Penedo",
  RIO_LARGO: "UFAL - Campus Rio Largo",
  DELMIRO_GOUVEIA: "UFAL - Campus Delmiro Gouveia",
  SANTANA_IPANEMA: "UFAL - Campus Santana do Ipanema",
};

export const ACTION_STATUS_LABELS: Record<ActivityStatus, string> = {
  OPEN: "Inscrições Abertas",
  IN_PROGRESS: "Em Andamento",
  COMPLETED: "Finalizada",
  CANCELLED: "Cancelada",
};

export const ACTION_TYPE_OPTIONS = (
  Object.keys(ACTION_TYPE_LABELS) as ActivityType[]
).map((value) => ({ value, label: ACTION_TYPE_LABELS[value] }));

export const ACTION_FORMAT_OPTIONS = (
  Object.keys(ACTION_FORMAT_LABELS) as ActivityFormat[]
).map((value) => ({ value, label: ACTION_FORMAT_LABELS[value] }));

export const ACTION_CAMPUS_OPTIONS = (
  Object.keys(ACTION_CAMPUS_LABELS) as CampusLocation[]
).map((value) => ({ value, label: ACTION_CAMPUS_LABELS[value] }));

export const ACTION_STATUS_OPTIONS = [
  { value: "all", label: "Todos os status" },
  ...(Object.keys(ACTION_STATUS_LABELS) as ActivityStatus[]).map((value) => ({
    value,
    label: ACTION_STATUS_LABELS[value],
  })),
];

export const FILTER_OPTIONS = {
  areas: [
    { value: "all", label: "Todas as áreas" },
    { value: "educacao", label: "Educação" },
    { value: "saude", label: "Saúde" },
    { value: "meio-ambiente", label: "Meio Ambiente" },
    { value: "arquitetura", label: "Arquitetura" },
  ],
  actionTypes: [
    { value: "all", label: "Todos os tipos" },
    ...ACTION_TYPE_OPTIONS,
  ],
  status: ACTION_STATUS_OPTIONS,
};
