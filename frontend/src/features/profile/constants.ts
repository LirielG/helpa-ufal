import type { UserActivity } from "./types";

export const MOCK_ACTIVITIES: UserActivity[] = [
  // Inscritas
  {
    id: "i1",
    title: "Preservação Ambiental - Plantio de Mudas",
    description:
      "Projeto de extensão oferecendo reforço escolar para alunos do ensino fundamental.",
    location: "UNIESQUINA - Xique-Xique, BA",
    date: "09/05/2026",
    status: "enrolled",
  },
  {
    id: "i2",
    title: "Mutirão de Limpeza do Rio São Francisco",
    description:
      "Ação coletiva de coleta de resíduos e conscientização ambiental às margens do rio.",
    location: "UFOB - Barreiras, BA",
    date: "22/05/2026",
    status: "enrolled",
  },
  {
    id: "i3",
    title: "Oficina de Robótica para Iniciantes",
    description:
      "Introdução à montagem e programação de robôs com kits educacionais Arduino.",
    location: "UFAL - Arapiraca, AL",
    date: "03/06/2026",
    status: "enrolled",
  },
  {
    id: "i4",
    title: "Feira de Saúde Comunitária",
    description:
      "Aferição de pressão, orientações nutricionais e atividades de prevenção à comunidade.",
    location: "UFPB - João Pessoa, PB",
    date: "14/06/2026",
    status: "enrolled",
  },
  // Concluídas
  {
    id: "c1",
    title: "Alfabetização Digital para Idosos",
    description:
      "Aulas práticas de uso de smartphones e internet para a terceira idade.",
    location: "UFRN - Natal, RN",
    date: "12/01/2026",
    status: "completed",
    workloadHours: 24,
  },
  {
    id: "c2",
    title: "Mutirão de Saúde Comunitária 2025",
    description:
      "Atendimentos de triagem e palestras educativas sobre prevenção de doenças.",
    location: "UFPB - Bayeux, PB",
    date: "14/03/2026",
    status: "completed",
    workloadHours: 20,
  },
  {
    id: "c3",
    title: "Oficina de Teatro na Comunidade",
    description:
      "Vivências de expressão corporal e montagem de espetáculo com jovens da periferia.",
    location: "UFRN - Mossoró, RN",
    date: "19/02/2026",
    status: "completed",
    workloadHours: 16,
  },
  {
    id: "c4",
    title: "Reforço Escolar de Matemática",
    description:
      "Acompanhamento pedagógico em matemática para alunos do ensino médio.",
    location: "UFAL - Maceió, AL",
    date: "28/02/2026",
    status: "completed",
    workloadHours: 12,
  },
  // Gerenciadas
  {
    id: "g1",
    title: "Campanha de Arrecadação de Agasalhos",
    description:
      "Organização logística da coleta, triagem e distribuição de roupas de inverno.",
    location: "UNIESQUINA - Xique-Xique, BA",
    date: "01/06/2026",
    status: "managed",
  },
  {
    id: "g2",
    title: "Hackathon de Tecnologia Social",
    description:
      "Maratona de desenvolvimento de soluções digitais para problemas da comunidade.",
    location: "UFAL - Arapiraca, AL",
    date: "18/07/2026",
    status: "managed",
  },
  {
    id: "g3",
    title: "Curso de Empreendedorismo Local",
    description:
      "Minicurso de gestão e finanças para pequenos empreendedores da região.",
    location: "UFOB - Barreiras, BA",
    date: "05/08/2026",
    status: "managed",
  },
  {
    id: "g4",
    title: "Projeto Horta Comunitária",
    description:
      "Coordenação do plantio e manutenção de hortas em escolas públicas.",
    location: "UFPB - João Pessoa, PB",
    date: "20/08/2026",
    status: "managed",
  },
];
