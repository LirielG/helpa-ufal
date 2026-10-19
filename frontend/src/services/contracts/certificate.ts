/**
 * Wire types for `GET /certificate-validations/:validationCode`.
 *
 * Written from the Bruno example (`backend/docs/bruno/Certificates/Validate
 * certificate.yml`), not from the backend code (§8).
 */

/**
 * Exactly what the printed certificate attests. A malformed code, an unknown
 * code and a certificate whose presence was corrected all answer the same 404.
 */
export interface CertificateValidation {
  /** Stored form: 10 Crockford Base32 characters, without the hyphen. */
  validationCode: string;
  holderName: string;
  activityTitle: string;
  /** ISO 8601 UTC. */
  activityStartDate: string;
  /** ISO 8601 UTC. */
  activityEndDate: string;
  /** Hours confirmed for the holder, not the activity's nominal workload. */
  workloadHours: number;
  /** ISO 8601 UTC. Later than the paper in hand after a reissue. */
  issuedAt: string;
}
