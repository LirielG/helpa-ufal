import type { Certificate, EnrollmentStatus, Prisma } from "@prisma/client";

/** What the PDF needs, plus what the ownership and attendance checks read. */
export type CertificateForDownload = {
  id: string;
  validationCode: string;
  issuedAt: Date;
  enrollment: {
    userId: string;
    status: EnrollmentStatus;
    attendanceConfirmed: boolean | null;
    confirmedWorkloadHours: number;
    user: { fullName: string };
    activity: { title: string; startDate: Date; endDate: Date };
  };
};

/** What the public validation answers, plus the attendance check it reads. */
export type CertificateForValidation = {
  validationCode: string;
  issuedAt: Date;
  enrollment: {
    status: EnrollmentStatus;
    attendanceConfirmed: boolean | null;
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

  /** Expects the stored form of the code; ignores the activity's soft delete. */
  findByValidationCode(
    validationCode: string,
  ): Promise<CertificateForValidation | null>;

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
