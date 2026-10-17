import type { Certificate, Prisma } from "@prisma/client";

// Every method takes the transaction client: a certificate is only ever
// written inside the transaction that writes the attendance it attests.
export interface ICertificateRepository {
  create(
    tx: Prisma.TransactionClient,
    data: { enrollmentId: string; validationCode: string; issuedAt: Date },
  ): Promise<Certificate>;

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
