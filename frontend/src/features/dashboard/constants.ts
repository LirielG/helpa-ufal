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

export const ACTION_AREAS = [
  { value: "robotica", label: "Robótica" },
  { value: "educacao", label: "Educação" },
  { value: "saude", label: "Saúde" },
  { value: "meio_ambiente", label: "Meio Ambiente" },
  { value: "arquitetura", label: "Arquitetura" },
];

export const ACTION_TYPES = [
  { value: "oficina", label: "Oficina" },
  { value: "palestra", label: "Palestra" },
  { value: "evento", label: "Evento" },
  { value: "servico", label: "Serviço" },
  { value: "minicurso", label: "Minicurso" },
];

export const ACTION_FORMATS = [
  { value: "presencial", label: "Presencial" },
  { value: "remoto", label: "Remoto" },
  { value: "hibrido", label: "Híbrido" },
];

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  EXTENSION: "Extensão",
  COURSE: "Curso/Oficina",
  EVENT: "Evento",
  LECTURE: "Palestra",
  OTHER: "Outro",
};

export const ACTION_FORMAT_LABELS: Record<ActionFormat, string> = {
  IN_PERSON: "Presencial",
  ONLINE: "Remoto",
  HYBRID: "Híbrido",
};

export const ACTION_CAMPUS_LABELS: Record<ActionCampus, string> = {
  MACEIO: "Maceió",
  ARAPIRACA: "Arapiraca",
  PALMEIRA: "Palmeira dos Índios",
  PENEDO: "Penedo",
  RIO_LARGO: "Rio Largo",
  DELMIRO_GOUVEIA: "Delmiro Gouveia",
  SANTANA_IPANEMA: "Santana do Ipanema",
};

export const ACTION_TYPE_OPTIONS = (
  Object.keys(ACTION_TYPE_LABELS) as ActionType[]
).map((value) => ({ value, label: ACTION_TYPE_LABELS[value] }));
