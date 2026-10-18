import type { Certificate, Prisma } from "@prisma/client";

/** What the PDF needs, plus the holder's id for the ownership check. */
export type CertificateForDownload = {
  id: string;
  validationCode: string;
  issuedAt: Date;
  enrollment: {
    userId: string;
    confirmedWorkloadHours: number;
    user: { fullName: string };
    activity: { title: string; startDate: Date; endDate: Date };
  };
};

// Every write takes the transaction client: a certificate is only ever
// written inside the transaction that writes the attendance it attests.
export interface ICertificateRepository {
  /** Ignores the activity's soft delete: the certificate stays the holder's document. */
  findByIdForDownload(id: string): Promise<CertificateForDownload | null>;

  /** Returns null, without raising, when the validation code is taken. */
  create(
    tx: Prisma.TransactionClient,
    data: { enrollmentId: string; validationCode: string; issuedAt: Date },
  ): Promise<Certificate | null>;

  updateIssuedAt(
    tx: Prisma.TransactionClient,
    enrollmentId: string,
    issuedAt: Date,
  ): Promise<Certificate>;

  deleteByEnrollmentId(
    tx: Prisma.TransactionClient,
    enrollmentId: string,
  ): Promise<void>;
}
