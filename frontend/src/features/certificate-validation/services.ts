import { api } from "@/services/api";
import type { CertificateValidation } from "@/services/contracts/certificate";

/**
 * Looks up the certificate a printed code belongs to. Throws ApiError on
 * failure, a 404 included: the caller tells "not found" from "failed".
 *
 * The code goes as typed: the backend owns the normalization (case, hyphens,
 * look-alike letters), so the rule lives in one place.
 */
export async function validateCertificate(
  code: string,
): Promise<CertificateValidation> {
  // The route is public: a 401 here says nothing about the visitor's session.
  const result = await api.get<CertificateValidation>(
    `/certificate-validations/${encodeURIComponent(code)}`,
    { handleUnauthorized: false },
  );

  // Picked field by field so nothing the API may add later reaches the screen.
  return {
    validationCode: result.validationCode,
    holderName: result.holderName,
    activityTitle: result.activityTitle,
    activityStartDate: result.activityStartDate,
    activityEndDate: result.activityEndDate,
    workloadHours: result.workloadHours,
    issuedAt: result.issuedAt,
  };
}
