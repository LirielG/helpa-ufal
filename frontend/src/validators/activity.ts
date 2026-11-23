import { z } from "zod";
import {
  ACTIVITY_TITLE_MAX_LENGTH,
  ACTIVITY_TITLE_TOO_LONG_MESSAGE,
} from "./limits";

export function activityTitleSchemaFor(savedTitle?: string) {
  return z
    .string()
    .trim()
    .min(1, "O título é obrigatório")
    .max(ACTIVITY_TITLE_MAX_LENGTH, ACTIVITY_TITLE_TOO_LONG_MESSAGE)
    .refine(
      // Older actions may keep a short title when only other fields change.
      (title) => title.length >= 3 || title === savedTitle?.trim(),
      "O título deve ter no mínimo 3 caracteres",
    );
}

export const activityTitleSchema = activityTitleSchemaFor();

/** Shared by the create and edit forms so the two cannot drift apart again. */
export const activityDescriptionSchema = z
  .string()
  .trim()
  .min(1, "A descrição é obrigatória")
  .min(10, "A descrição deve ter no mínimo 10 caracteres");

export const ACTION_URL_INVALID_MESSAGE =
  "Informe um link válido, como https://meet.google.com/abc-defg-hij.";

const SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;

/** People paste meeting links without the scheme, so `https://` is assumed. */
export function normalizeActionUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || SCHEME_PATTERN.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// The domain rule keeps a bare word like "nao-e-um-link" from passing once
// the scheme is added; the API only restricts the protocol.
const actionUrlSchema = z.url({
  protocol: /^https?$/,
  hostname: z.regexes.domain,
});

export function isValidActionUrl(value: string) {
  if (!actionUrlSchema.safeParse(value).success) return false;

  // With the scheme added, "www.google.com@evil.com" would point at evil.com
  // and "mailto:a@b.br" at b.br, so a link carrying credentials is refused.
  const { username, password } = new URL(value);
  return !username && !password;
}

const MS_PER_HOUR = 1000 * 60 * 60;

export const WORKLOAD_EXCEEDS_DURATION_MESSAGE =
  "A carga horária não pode passar da duração da ação.";

/** Whole hours between start and end, rounded down; null when the range is invalid. */
export function maxWorkloadHoursFor(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
): number | null {
  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end <= start) return null;
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_HOUR);
}

export function workloadExceedsDurationMessage(maxHours: number): string {
  return `A carga horária não pode passar da duração da ação (${maxHours.toLocaleString("pt-BR")} h).`;
}

export function validateWorkloadDuration(
  data: {
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    workloadHours: number;
  },
  ctx: z.RefinementCtx,
): void {
  const maxHours = maxWorkloadHoursFor(
    data.startDate,
    data.startTime,
    data.endDate,
    data.endTime,
  );
  if (maxHours !== null && data.workloadHours > maxHours) {
    ctx.addIssue({
      code: "custom",
      message: workloadExceedsDurationMessage(maxHours),
      path: ["workloadHours"],
    });
  }
}
