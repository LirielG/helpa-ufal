export interface JourneyStep {
  number: string;
  title: string;
  description: string;
}

export const HELPA_JOURNEY_TITLE =
  "Como funcionam as ações e certificados no Helpa?";

export const HELPA_JOURNEY_STEPS: readonly JourneyStep[] = [
  {
    number: "1",
    title: "Inscrição e Participação",
    description:
      "Você escolhe uma ação voluntária disponível no feed, realiza sua inscrição e participa das atividades programadas pelo responsável.",
  },
  {
    number: "2",
    title: "Conclusão da Ação",
    description:
      "Ao encerrar o período das atividades, o criador ou gestor altera o status da ação para Concluída.",
  },
  {
    number: "3",
    title: "Homologação de Presença e Carga Horária",
    description:
      "O criador ou gestor da ação analisa a lista de inscritos e homologa a presença e a carga horária final de cada participante.",
  },
  {
    number: "4",
    title: "Emissão Automática do Certificado",
    description:
      "Assim que a sua presença é homologada como presente, o certificado é gerado automaticamente pelo sistema com a carga horária homologada.",
  },
  {
    number: "5",
    title: "Download no Seu Perfil",
    description:
      'O documento fica disponível para download em PDF diretamente no card da ação, dentro da aba "Atividades Concluídas" do seu perfil.',
  },
];

export const COMPLETED_CERTIFICATES_NOTICE = {
  title: "Sobre os seus certificados:",
  description:
    "O certificado aparece no card para download depois que o responsável homologa sua presença e suas horas. Ações concluídas sem homologação de presença não geram certificado.",
  linkPrefix: "Dúvidas sobre o fluxo? Acesse ",
  linkLabel: "Como funciona",
} as const;
