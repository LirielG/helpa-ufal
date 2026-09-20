import type { ActionCampus, ActionFormat, ActionType } from "./types";

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
    { value: "oficina", label: "Oficina" },
    { value: "palestra", label: "Palestra" },
    { value: "evento", label: "Evento" },
    { value: "servico", label: "Serviço" },
    { value: "minicurso", label: "Minicurso" },
  ],
  availability: [
    { value: "all", label: "Todas as vagas" },
    { value: "available", label: "Vagas Disponíveis" },
    { value: "full", label: "Vagas Esgotadas" },
  ],
};

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  EXTENSION: "Ação de extensão",
  COURSE: "Curso ou minicurso",
  EVENT: "Evento",
  LECTURE: "Palestra",
  OTHER: "Outro",
};

export const ACTION_FORMAT_LABELS: Record<ActionFormat, string> = {
  IN_PERSON: "Presencial",
  ONLINE: "On-line",
  HYBRID: "Híbrido",
};

export const ACTION_CAMPUS_LABELS: Record<ActionCampus, string> = {
  MACEIO: "UFAL - Campus Maceió",
  ARAPIRACA: "UFAL - Campus Arapiraca",
  PALMEIRA: "UFAL - Campus Palmeira dos Índios",
  PENEDO: "UFAL - Campus Penedo",
  RIO_LARGO: "UFAL - Campus Rio Largo",
  DELMIRO_GOUVEIA: "UFAL - Campus Delmiro Gouveia",
  SANTANA_IPANEMA: "UFAL - Campus Santana do Ipanema",
};

export const ACTION_TYPE_OPTIONS = (
  Object.keys(ACTION_TYPE_LABELS) as ActionType[]
).map((value) => ({ value, label: ACTION_TYPE_LABELS[value] }));

export const ACTION_FORMAT_OPTIONS = (
  Object.keys(ACTION_FORMAT_LABELS) as ActionFormat[]
).map((value) => ({ value, label: ACTION_FORMAT_LABELS[value] }));

export const ACTION_CAMPUS_OPTIONS = (
  Object.keys(ACTION_CAMPUS_LABELS) as ActionCampus[]
).map((value) => ({ value, label: ACTION_CAMPUS_LABELS[value] }));

export const ACTION_AREA_LABELS = [
  "Robótica",
  "Educação",
  "Saúde",
  "Meio Ambiente",
  "Arquitetura",
] as const;

export const ACTION_AREA_OPTIONS = ACTION_AREA_LABELS.map((label) => ({
  value: label,
  label,
}));
