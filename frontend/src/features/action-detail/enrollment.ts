import type { Activity } from "@/services/contracts/activity";

export type UnavailableEnrollmentLabel =
  "Inscrição indisponível" | "Vagas esgotadas";

/**
 * Why enrolling is off the table, shared by the signed-in and visitor
 * controls so both read the same rule. A visitor has no enrollmentStatus,
 * so the REJECTED branch only ever applies to a signed-in user.
 */
export function getUnavailableEnrollmentLabel(
  action: Activity,
): UnavailableEnrollmentLabel | null {
  if (action.enrollmentStatus === "REJECTED" || action.status !== "OPEN") {
    return "Inscrição indisponível";
  }
  if (action.availableSlots === 0) {
    return "Vagas esgotadas";
  }
  return null;
}
