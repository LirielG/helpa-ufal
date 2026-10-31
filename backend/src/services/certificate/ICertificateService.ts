import type { AuthenticatedUser } from "@/types/auth.js";
export type CertificateFile = {
  fileName: string;
  content: Uint8Array;
};

/** Exactly what the PDF prints, and nothing about the holder beyond the name. */
export type CertificateValidation = {
  validationCode: string;
  holderName: string;
  activityTitle: string;
  activityStartDate: Date;
  activityEndDate: Date;
  workloadHours: number;
  issuedAt: Date;
};

export interface ICertificateService {
  getFile(
    user: Pick<AuthenticatedUser, "id" | "isManager">,
    certificateId: string,
  ): Promise<CertificateFile>;
  validate(input: string): Promise<CertificateValidation>;
}
