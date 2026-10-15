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

export const CreateActivitySchema = z
  .discriminatedUnion("format", [
    BaseActivitySchema.extend({
      format: z.literal("IN_PERSON"),
      address: AddressSchema,
    }),
    BaseActivitySchema.extend({
      format: z.literal("ONLINE"),
    }),
    BaseActivitySchema.extend({
      format: z.literal("HYBRID"),
      url: z.url(),
      address: AddressSchema,
    }),
  ])
  .refine(
    (data) => data.startDate < data.endDate,
    { message: "startDate must be before endDate.", path: ["startDate"] },
  );

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
    url: z.url().nullable().optional(),
    address: AddressSchema.nullable().optional(),
  })
  .partial();

// A PATCH body is partial, so this schema only validates the shape of the fields sent.
// Rules that depend on the stored activity (IN_PERSON/HYBRID need an address, HYBRID
// needs a url) live in ActivityService.update, which merges the body with the saved state.
// Do not reintroduce them here: Zod runs before the activity is read from the database.
export const UpdateActivitySchema = UpdateActivityBaseSchema.refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "Body cannot be empty. At least one field must be provided.",
    path: [],
  },
).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate < data.endDate;
    }
    return true;
  },
  { message: "startDate must be before endDate.", path: ["startDate"] },
);

export type UpdateActivityInput = z.infer<typeof UpdateActivitySchema>;

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
