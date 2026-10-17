export type CertificatePdfData = {
  holderName: string;
  activityTitle: string;
  activityStartDate: Date;
  activityEndDate: Date;
  workloadHours: number; // Enrollment.confirmedWorkloadHours, never ActivityDetails.workloadHours
  issuedAt: Date;
  validationCode: string; // stored form: 10 Crockford chars, no hyphen
};

export interface ICertificatePdfRenderer {
  render(data: CertificatePdfData): Promise<Uint8Array>;
}
