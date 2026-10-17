import type { Certificate, Prisma } from "@prisma/client";
import type { ICertificateRepository } from "@/repositories/certificate/ICertificateRepository.js";

class CertificateRepository implements ICertificateRepository {
  public async create(
    tx: Prisma.TransactionClient,
    data: { enrollmentId: string; validationCode: string; issuedAt: Date },
  ): Promise<Certificate> {
    return tx.certificate.create({ data });
  }

  public async updateIssuedAt(
    tx: Prisma.TransactionClient,
    enrollmentId: string,
    issuedAt: Date,
  ): Promise<Certificate> {
    return tx.certificate.update({
      where: { enrollmentId },
      data: { issuedAt },
    });
  }

  public async deleteByEnrollmentId(
    tx: Prisma.TransactionClient,
    enrollmentId: string,
  ): Promise<void> {
    await tx.certificate.delete({ where: { enrollmentId } });
  }
}

export default CertificateRepository;
