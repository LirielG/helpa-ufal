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
    type: z.enum(["EXTENSION", "COURSE", "EVENT", "LECTURE", "OTHER"], {
      message: "Selecione um tipo de ação",
    }),
    slots: z.coerce
      .number({ message: "A quantidade de vagas deve ser um número válido" })
      .int("A quantidade de vagas deve ser um número inteiro")
      .positive("A quantidade de vagas deve ser maior que zero")
      .min(1, "Informe a quantidade de vagas"),
    workloadHours: z.coerce
      .number({ message: "Informe a carga horária" })
      .int("A carga horária deve ser um número inteiro")
      .positive("A carga horária deve ser maior que zero"),
    format: z.enum(["ONLINE", "IN_PERSON", "HYBRID"], {
      message: "Selecione o formato da ação",
    }),
    area: z.enum(["Robótica", "Educação", "Saúde", "Meio Ambiente", "Arquitetura"], {
      message: "Selecione uma área de atuação",
    }),
    campus: z.enum(["MACEIO", "ARAPIRACA", "PALMEIRA", "PENEDO", "RIO_LARGO", "DELMIRO_GOUVEIA", "SANTANA_IPANEMA"],
      { message: "Selecione o campus" }
    ),
    url: z
      .string()
      .url("Informe uma URL válida")
      .optional()
      .or(z.literal("")),
    address: z
      .object({
        addressLine: z.string().optional().or(z.literal("")),
        district: z.string().optional().or(z.literal("")),
        zipCode: z.string().optional().or(z.literal("")),
        city: z.string().optional().or(z.literal("")),
        state: z.string().optional().or(z.literal("")),
      })
      .optional(),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "A data de encerramento deve ser posterior à data de início",
    path: ["endDate"],
  })
  .refine(
    (data) => {
      if (data.format === "ONLINE" || data.format === "HYBRID") {
        return !!data.url && data.url.trim().length > 0;
      }
      return true;
    },
    {
      message: "Link do evento é obrigatório para ações on-line ou híbridas",
      path: ["url"],
    }
  )
  .refine(
    (data) => {
      if (data.format === "IN_PERSON" || data.format === "HYBRID") {
        return (
          !!data.address?.addressLine?.trim() &&
          !!data.address?.district?.trim() &&
          !!data.address?.zipCode?.trim() &&
          !!data.address?.city?.trim() &&
          !!data.address?.state?.trim()
        );
      }
      return true;
    },
    {
      message: "Endereço completo é obrigatório para ações presenciais ou híbridas",
      path: ["address", "addressLine"],
    }
  );

export type ActionEditSchemaType = z.infer<typeof ActionEditSchema>;
