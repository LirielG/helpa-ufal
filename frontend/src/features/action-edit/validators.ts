import { z } from "zod";
import {
  activityDescriptionSchema,
  activityTitleSchema,
  activityTitleSchemaFor,
} from "../../validators/activity";

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

const actionEditBaseSchema = z
  .object({
    title: activityTitleSchema,
    description: z.string().trim(),
    startDate: z.string().min(1, "A data de início é obrigatória"),
    endDate: z.string().min(1, "A data de encerramento é obrigatória"),
    startTime: z.string().min(1, "O horário de início é obrigatório"),
    endTime: z.string().min(1, "O horário de encerramento é obrigatório"),
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
    // Free text, like the API: suggestions help reuse an existing spelling,
    // but any area is accepted.
    area: z.string().trim().min(1, "Informe uma área de atuação"),
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
    url: z.string(),
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
  .refine(
    (data) =>
      new Date(`${data.endDate}T${data.endTime}`) >
      new Date(`${data.startDate}T${data.startTime}`),
    {
      message: "A data de encerramento deve ser posterior à de início.",
      path: ["endDate"],
    },
  )
  .superRefine((data, ctx) => {
    // In person the link field is hidden, so whatever it still holds is not
    // checked: an error there would block the save with nothing on screen.
    if (data.format === "IN_PERSON") return;

    if (!data.url.trim()) {
      ctx.addIssue({
        code: "custom",
        message:
          "Informe um link válido. Ele é obrigatório em ações on-line e híbridas.",
        path: ["url"],
      });
    } else if (!z.url().safeParse(data.url).success) {
      ctx.addIssue({
        code: "custom",
        message: "Informe uma URL válida",
        path: ["url"],
      });
    }
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

/**
 * The description rule only binds a description the user is changing: actions
 * created while the description was optional may hold a shorter one, and that
 * must not block an unrelated edit.
 */
export function actionEditSchemaFor(
  savedDescription: string,
  savedTitle: string,
) {
  return actionEditBaseSchema
    .safeExtend({
      title: activityTitleSchemaFor(savedTitle),
    })
    .superRefine(({ description }, ctx) => {
      if (description === savedDescription.trim()) return;

      const result = activityDescriptionSchema.safeParse(description);
      if (!result.success) {
        ctx.addIssue({
          code: "custom",
          message: result.error.issues[0].message,
          path: ["description"],
        });
      }
    });
}

export type ActionEditSchemaType = z.infer<typeof actionEditBaseSchema>;
