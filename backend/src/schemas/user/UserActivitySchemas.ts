import { z } from "zod";
import { PaginationQuerySchema } from "@/schemas/common/PaginationSchemas.js";

export const ListUserActivitiesQuerySchema = PaginationQuerySchema.extend({
  filter: z.enum(
    ["enrolled", "completed", "managed"],
    "filter must be one of: enrolled, completed, managed.",
  ),
});

export type ListUserActivitiesQuery = z.output<
  typeof ListUserActivitiesQuerySchema
>;
