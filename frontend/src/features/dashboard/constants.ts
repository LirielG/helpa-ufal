import type { Action } from "./types";

export const MOCK_ACTIONS: Action[] = [
  {
    id: "1",
    title: "Oficina de Programação",
    description: "Ensinar fundamentos de programação e desenvolvimento web para jovens de escolas...",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400",
    location: "UFAL, Arapiraca - AL",
    date: "09/05/2026",
    spots: 30,
    type: "oficina",
    status: "available",
    workload: 0,
    format: "",
    cep: 0,
    city: "",
    state: "",
  },
  {
    id: "2",
    title: "Aulas de Reforço de Matemática",
    description: "Oferecer aulas de reforço para auxiliar alunos do ensino fundamental em matemática básica. Os...",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400",
    location: "UFAL, Arapiraca - AL",
    date: "08/05/2026",
    spots: 15,
    type: "oficina",
    status: "full",
    workload: 0,
    format: "",
    cep: 0,
    city: "",
    state: "",
  },
  {
    id: "3",
    title: "Oficina de Programação",
    description: "Ensinar fundamentos de programação e desenvolvimento web para jovens de escolas...",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400",
    location: "UFAL, Arapiraca - AL",
    date: "09/05/2026",
    spots: 30,
    type: "oficina",
    status: "available",
    workload: 0,
    format: "",
    cep: 0,
    city: "",
    state: "",
  },
  {
    id: "4",
    title: "Oficina de Programação em blocos",
    description: "Ensinar fundamentos de programação e desenvolvimento web para jovens de escolas...",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400",
    location: "UFAL, Arapiraca - AL",
    date: "09/05/2026",
    spots: 30,
    type: "oficina",
    status: "available",
    workload: 0,
    format: "",
    cep: 0,
    city: "",
    state: "",
  },
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