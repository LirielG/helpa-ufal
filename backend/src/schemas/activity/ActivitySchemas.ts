import { z } from "zod";
import { ActivityType, ActivityFormat, ActivityStatus, CampusLocation } from "@prisma/client";

const AddressSchema = z.object({
  addressLine: z.string().min(1),
  district:    z.string().min(1),
  zipCode:     z.string().min(1),
  city:        z.string().min(1),
  state:       z.string().min(1),
});

const BaseActivitySchema = z.object({
  title:        z.string().min(1),
  type:         z.enum(ActivityType),
  campus:       z.enum(CampusLocation),
  startDate:    z.coerce.date(),
  endDate:      z.coerce.date(),
  slots:        z.number().int().min(1),
  description:  z.string().min(1),
  area:         z.string().min(1),
  workloadHours: z.number().int().min(1),
  url:          z.string().url().optional(),
});

export const CreateActivitySchema = z.discriminatedUnion("format", [
  BaseActivitySchema.extend({
    format:  z.literal("IN_PERSON"),
    address: AddressSchema,           
  }),
  BaseActivitySchema.extend({
    format:  z.literal("ONLINE"),
    url:     z.url(),
    address: AddressSchema.optional(),
  }),
  BaseActivitySchema.extend({
    format:  z.literal("HYBRID"),
    url:     z.url(),  
    address: AddressSchema,
  }),
]).refine(
  (data) => data.startDate < data.endDate,
  { message: "startDate must be before endDate.", path: ["startDate"] }, // não tenho certeza se deixo esse tratamento aqui
);

export type CreateActivityInput = z.infer<typeof CreateActivitySchema>;