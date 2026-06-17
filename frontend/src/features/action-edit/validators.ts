import { z } from "zod";

export const ActionEditSchema = z
  .object({
    title: z
      .string()
      .min(1, "O título é obrigatório")
      .min(3, "O título deve ter no mínimo 3 caracteres"),
    description: z
      .string()
      .min(1, "A descrição é obrigatória")
      .min(10, "A descrição deve ter no mínimo 10 caracteres"),
    startDate: z.string().min(1, "A data de início é obrigatória"),
    endDate: z.string().min(1, "A data de encerramento é obrigatória"),
    type: z.enum(["oficina", "palestra", "evento", "servico", "minicurso"], {
      message: "Selecione um tipo de ação",
    }),
    spots: z.coerce
      .number({ message: "Informe a quantidade de vagas" })
      .int("A quantidade de vagas deve ser um número inteiro")
      .positive("A quantidade de vagas deve ser maior que zero"),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "A data de encerramento deve ser posterior à data de início",
    path: ["endDate"],
  });

export type ActionEditSchemaType = z.infer<typeof ActionEditSchema>;