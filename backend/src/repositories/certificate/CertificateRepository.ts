import { randomUUID } from "node:crypto";
import type { Certificate, Prisma } from "@prisma/client";
import type { ICertificateRepository } from "@/repositories/certificate/ICertificateRepository.js";

class CertificateRepository implements ICertificateRepository {
  public async create(
    tx: Prisma.TransactionClient,
    data: { enrollmentId: string; validationCode: string; issuedAt: Date },
  ): Promise<Certificate | null> {
    // Raw SQL because Prisma cannot target ON CONFLICT at a single column. A
    // code collision must not raise: in Postgres any error aborts the
    // surrounding transaction, so the caller could not redraw in it. Only the
    // validationCode conflict is absorbed; a second certificate for the same
    // enrollment still fails. id and updatedAt are filled here because their
    // defaults live in the Prisma client, not in the table.
    const rows = await tx.$queryRaw<Certificate[]>`
      INSERT INTO "Certificate" ("id", "enrollmentId", "validationCode", "issuedAt", "updatedAt")
      VALUES (${randomUUID()}, ${data.enrollmentId}, ${data.validationCode}, ${data.issuedAt}, ${new Date()})
      ON CONFLICT ("validationCode") DO NOTHING
      RETURNING *
    `;
    return rows[0] ?? null;
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
