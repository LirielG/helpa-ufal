import { z } from "zod";
import { ActivityType, ActivityFormat, CampusLocation } from "@prisma/client";
import { ActivityStatus } from "@/types/activity.js";

const BrazilianStates = [
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

const AddressSchema = z.object({
  addressLine: z.string().trim().min(1),
  district: z.string().trim().min(1),
  zipCode: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "zipCode must contain exactly 8 digits."),
  city: z.string().trim().min(1),
  state: z.enum(BrazilianStates, {
    message:
      "state must be a valid Brazilian state abbreviation (e.g. AL, SP, RJ).",
  }),
});

const BaseActivitySchema = z.object({
  title: z.string().min(1),
  type: z.enum(ActivityType),
  campus: z.enum(CampusLocation),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  slots: z.number().int().min(1),
  description: z.string().trim().min(1),
  area: z.string().trim().min(1),
  workloadHours: z.number().int().min(1),
  url: z.url().optional(),
});

/**
 * `format` decides what else the activity must carry, so the schema is a union
 * discriminated by it rather than one object with optional fields: an IN_PERSON
 * activity without an address fails here, at parse time, and the service never
 * has to re-check it.
 *
 * The date range is refined on the union, not on the base object, because a
 * refinement on a member runs before the discriminant is resolved.
 */
export const CreateActivitySchema = z
  .discriminatedUnion("format", [
    BaseActivitySchema.extend({
      format: z.literal("IN_PERSON"),
      address: AddressSchema,
    }),
    BaseActivitySchema.extend({
      format: z.literal("ONLINE"),
      url: z.url(),
      address: AddressSchema.optional(),
    }),
    BaseActivitySchema.extend({
      format: z.literal("HYBRID"),
      url: z.url(),
      address: AddressSchema,
    }),
  ])
  .refine((data) => data.startDate < data.endDate, {
    message: "startDate must be before endDate.",
    path: ["startDate"],
  });

export type CreateActivityInput = z.infer<typeof CreateActivitySchema>;

const UpdateActivityBaseSchema = z
  .object({
    title: z.string().min(1),
    type: z.enum(ActivityType),
    campus: z.enum(CampusLocation),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    slots: z.number().int().min(1),
    description: z.string().trim().min(1),
    area: z.string().trim().min(1),
    workloadHours: z.number().int().min(1),
    format: z.enum(["IN_PERSON", "ONLINE", "HYBRID"]),
    url: z.string().url().nullable().optional(),
    address: AddressSchema.nullable().optional(),
  })
  .partial();

/**
 * Partial update: every field is optional, so the only structural rule the
 * schema can enforce is that the body is not empty.
 *
 * The format rules below only fire when `format` is in the BODY. A request that
 * omits it is still subject to them — against the format already saved — and the
 * schema cannot see that. ActivityService.update re-checks the whole
 * combination against the stored activity, and that check is the authoritative
 * one; this one just fails earlier, with a per-field message.
 */
export const UpdateActivitySchema = UpdateActivityBaseSchema.refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "Body cannot be empty. At least one field must be provided.",
    path: [],
  },
)
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate < data.endDate;
      }
      return true;
    },
    { message: "startDate must be before endDate.", path: ["startDate"] },
  )
  .superRefine((data, ctx) => {
    if (data.format === "IN_PERSON" && !data.address) {
      ctx.addIssue({
        code: "custom",
        message: "Address is required when format is IN_PERSON.",
        path: ["address"],
      });
    }

    if (data.format === "ONLINE" && !data.url) {
      ctx.addIssue({
        code: "custom",
        message: "URL is required when format is ONLINE.",
        path: ["url"],
      });
    }

    if (data.format === "HYBRID") {
      if (!data.url) {
        ctx.addIssue({
          code: "custom",
          message: "URL is required when format is HYBRID.",
          path: ["url"],
        });
      }
      if (!data.address) {
        ctx.addIssue({
          code: "custom",
          message: "Address is required when format is HYBRID.",
          path: ["address"],
        });
      }
    }
  });

export type UpdateActivityInput = z.infer<typeof UpdateActivitySchema>;

/**
 * OPEN is missing from the enum on purpose: it is the initial status and no
 * transition leads back to it, so a request asking for it is rejected as a bad
 * value rather than reaching the transition table.
 *
 * `.strict()` so an unknown key is an error instead of being dropped silently —
 * a typo in the field name must not read as "no status sent".
 */
export const UpdateActivityStatusSchema = z
  .object({
    status: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  })
  .strict();

export type UpdateActivityStatusInput = z.infer<
  typeof UpdateActivityStatusSchema
>;

export const allowedTransitions: Record<ActivityStatus, ActivityStatus[]> = {
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function isValidTransition(
  current: ActivityStatus,
  target: ActivityStatus,
): boolean {
  return allowedTransitions[current]?.includes(target) ?? false;
}
