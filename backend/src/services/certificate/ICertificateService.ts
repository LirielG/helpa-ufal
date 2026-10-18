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
  getFile(userId: string, certificateId: string): Promise<CertificateFile>;
  validate(input: string): Promise<CertificateValidation>;
}
