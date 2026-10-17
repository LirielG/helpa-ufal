import { describe, expect, it } from "vitest";
import { prisma } from "@/database/prisma.js";
import CertificateRepository from "@/repositories/certificate/CertificateRepository.js";
import {
  createActivity,
  createEnrollment,
  createStudent,
  createTeacher,
} from "../../helpers/factories.js";

async function anEnrollmentId() {
  const author = await createTeacher();
  const activity = await createActivity(author.user.id, {
    status: "COMPLETED",
  });
  const volunteer = await createStudent();
  const enrollment = await createEnrollment(volunteer.user.id, activity.id);
  return enrollment.id;
}

describe("CertificateRepository.create", () => {
  const repository = new CertificateRepository();

  it("stores the certificate and returns it with the given issuedAt", async () => {
    const enrollmentId = await anEnrollmentId();
    const issuedAt = new Date("2026-03-15T13:45:10.123Z");

    const created = await prisma.$transaction((tx) =>
      repository.create(tx, {
        enrollmentId,
        validationCode: "7KQ4MX9T2R",
        issuedAt,
      }),
    );

    const stored = await prisma.certificate.findUniqueOrThrow({
      where: { enrollmentId },
    });
    expect(created).toEqual(stored);
    expect(stored.issuedAt).toEqual(issuedAt);
  });

  it("returns null on a taken code and keeps the transaction usable", async () => {
    const first = await anEnrollmentId();
    const second = await anEnrollmentId();

    const redrawn = await prisma.$transaction(async (tx) => {
      await repository.create(tx, {
        enrollmentId: first,
        validationCode: "7KQ4MX9T2R",
        issuedAt: new Date(),
      });
      const collided = await repository.create(tx, {
        enrollmentId: second,
        validationCode: "7KQ4MX9T2R",
        issuedAt: new Date(),
      });
      expect(collided).toBeNull();

      return repository.create(tx, {
        enrollmentId: second,
        validationCode: "M3V8ZP1D6W",
        issuedAt: new Date(),
      });
    });

    expect(redrawn?.validationCode).toBe("M3V8ZP1D6W");
  });

  it("still rejects a second certificate for the same enrollment", async () => {
    const enrollmentId = await anEnrollmentId();
    await prisma.$transaction((tx) =>
      repository.create(tx, {
        enrollmentId,
        validationCode: "7KQ4MX9T2R",
        issuedAt: new Date(),
      }),
    );

    await expect(
      prisma.$transaction((tx) =>
        repository.create(tx, {
          enrollmentId,
          validationCode: "M3V8ZP1D6W",
          issuedAt: new Date(),
        }),
      ),
    ).rejects.toThrow();
  });
});
