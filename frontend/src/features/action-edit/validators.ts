import { z } from "zod";

/** Same list the API validates `address.state` against. */
const BRAZILIAN_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

/** The screen masks the zip code, the API takes the eight digits raw. */
const ZIP_CODE_PATTERN = /^\d{5}-?\d{3}$/;

const REQUIRED_ADDRESS_FIELDS = [
  ["addressLine", "Informe o logradouro"],
  ["district", "Informe o bairro"],
  ["zipCode", "Informe o CEP"],
  ["city", "Informe a cidade"],
  ["state", "Informe o estado"],
] as const;

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
      .min(1, "Informe a quantidade de vagas"),
    workloadHours: z.coerce
      .number({ message: "Informe a carga horária" })
      .int("A carga horária deve ser um número inteiro")
      .min(1, "A carga horária deve ser maior que zero"),
    format: z.enum(["ONLINE", "IN_PERSON", "HYBRID"], {
      message: "Selecione o formato da ação",
    }),
    // Free text, like the API: an action created before the closed list of #171
    // still has to be editable.
    area: z.string().trim().min(1, "Selecione uma área de atuação"),
    campus: z.enum(
      [
        "MACEIO",
        "ARAPIRACA",
        "PALMEIRA",
        "PENEDO",
        "RIO_LARGO",
        "DELMIRO_GOUVEIA",
        "SANTANA_IPANEMA",
      ],
      { message: "Selecione o campus" },
    ),
    url: z.string().url("Informe uma URL válida").or(z.literal("")),
    address: z
      .object({
        addressLine: z.string().trim(),
        district: z.string().trim(),
        zipCode: z.string().trim(),
        city: z.string().trim(),
        state: z.string().trim(),
      })
      .optional(),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "A data de encerramento deve ser posterior à data de início",
    path: ["endDate"],
  })
  .refine((data) => data.format === "IN_PERSON" || !!data.url, {
    message: "Link do evento é obrigatório para ações on-line ou híbridas",
    path: ["url"],
  })
  .superRefine((data, ctx) => {
    if (data.format === "ONLINE") return;

    REQUIRED_ADDRESS_FIELDS.forEach(([field, message]) => {
      if (!data.address?.[field]) {
        ctx.addIssue({ code: "custom", message, path: ["address", field] });
      }
    });

    const { zipCode, state } = data.address ?? {};

    if (zipCode && !ZIP_CODE_PATTERN.test(zipCode)) {
      ctx.addIssue({
        code: "custom",
        message: "O CEP deve ter 8 dígitos",
        path: ["address", "zipCode"],
      });
    }

    if (
      state &&
      !BRAZILIAN_STATES.includes(
        state.toUpperCase() as (typeof BRAZILIAN_STATES)[number],
      )
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Informe uma UF válida (ex.: AL)",
        path: ["address", "state"],
      });
    }
  });

export type ActionEditSchemaType = z.infer<typeof ActionEditSchema>;
