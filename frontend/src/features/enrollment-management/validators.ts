/**
 * Checks the hours typed for a presence before they are sent. The server keeps
 * the final say; this only spares the round trip for values it would refuse.
 */
export function validateWorkloadHours(
  value: string,
  workloadCeiling: number,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Informe as horas cumpridas.";

  const hours = Number(trimmed);
  if (!Number.isInteger(hours)) return "Informe um número inteiro de horas.";
  if (hours < 1) return "As horas devem ser no mínimo 1.";
  if (hours > workloadCeiling) {
    return `As horas não podem passar da carga horária da ação (${workloadCeiling} h).`;
  }

  return null;
}
