import type { Action } from "./types";

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
  { value: "arquitetura", label: "Arquitetura" }
];

export const ACTION_TYPES = [
  { value: "oficina", label: "Oficina" },
  { value: "palestra", label: "Palestra" },
  { value: "evento", label: "Evento" },
  { value: "servico", label: "Serviço" },
  { value: "minicurso", label: "Minicurso" },
]

export const ACTION_FORMATS = [
  { value: "presencial", label: "Presencial" },
  {value: "remoto", label: "Remoto" },
  {value: "hibrido", label: "Híbrido"}
]