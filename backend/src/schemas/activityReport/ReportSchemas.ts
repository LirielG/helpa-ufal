import { z } from "zod";

export const ListReportsQuerySchema = z.object({
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("10"),
  resolved: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return false; // Padrão: denúncias em aberto (resolvedAt = null)
    }),
});

export type ListReportsQuery = z.infer<typeof ListReportsQuerySchema>;

export interface ReportDTO {
  id: string;
  category: string;
  description: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  activity: {
    id: string;
    title: string;
    authorId: string;
  };
  reporter: {
    id: string;
    fullName: string;
  } | null;
}

export interface IListReportsResponse {
  items: ReportDTO[];
  total: number;
  page: number;
  limit: number;
}