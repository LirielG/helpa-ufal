import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import EnrollmentRepository from "@/repositories/enrollment/EnrollmentRepository.js";
import {
  createActivity,
  createEnrollment,
  createStudent,
  createTeacher,
} from "../../helpers/factories.js";
import { authCookie, invalidToken } from "../../helpers/auth.js";

const NOT_FOUND = { status: 404, code: "NOT_FOUND", message: "Certificate not found." };

/** A certificate issued the way the product issues it: by homologating presence. */
async function anIssuedCertificate() {
  const author = await createTeacher();
  const activity = await createActivity(author.user.id, {
    status: "COMPLETED",
    workloadHours: 20,
  });
  const holder = await createStudent();
  const enrollment = await createEnrollment(holder.user.id, activity.id);

  await new EnrollmentRepository().confirmAttendance(
    activity.id,
    enrollment.id,
    true,
    12,
  );
  const certificate = await prisma.certificate.findUniqueOrThrow({
    where: { enrollmentId: enrollment.id },
  });

  return { holder, activity, enrollment, certificate };
}

/** Swaps the drawn code for a known one, to exercise the normalization. */
async function withCode(certificateId: string, validationCode: string) {
  await prisma.certificate.update({
    where: { id: certificateId },
    data: { validationCode },
  });
}

function validate(code: string) {
  return request(app).get(
    `/certificate-validations/${encodeURIComponent(code)}`,
  );
}

describe("GET /certificate-validations/:validationCode", () => {
  it("answers exactly the seven fields the PDF prints", async () => {
    const { holder, activity, certificate } = await anIssuedCertificate();

    const response = await validate(certificate.validationCode);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toStrictEqual({
      validationCode: certificate.validationCode,
      holderName: holder.user.fullName,
      activityTitle: activity.title,
      activityStartDate: activity.startDate.toISOString(),
      activityEndDate: activity.endDate.toISOString(),
      workloadHours: 12,
      issuedAt: certificate.issuedAt.toISOString(),
    });
    for (const field of [
      "passwordHash",
      "email",
      "registrationCode",
      "userId",
      "enrollmentId",
      "id",
    ]) {
      expect(response.body).not.toHaveProperty(field);
    }
  });

  it("reflects the holder's current name and the hours as corrected after issuing", async () => {
    const { holder, activity, enrollment, certificate } =
      await anIssuedCertificate();
    await prisma.user.update({
      where: { id: holder.user.id },
      data: { fullName: "Maria Silva Souza" },
    });
    await new EnrollmentRepository().confirmAttendance(
      activity.id,
      enrollment.id,
      true,
      6,
    );

    const response = await validate(certificate.validationCode);

    expect(response.body).toMatchObject({
      holderName: "Maria Silva Souza",
      workloadHours: 6,
    });
  });

  it.each(["7KQ4MX9T2R", "7kq4mx9t2r", "7KQ4M-X9T2R", " 7KQ4M X9T2R "])(
    "finds the certificate by %j",
    async (input) => {
      const { certificate } = await anIssuedCertificate();
      await withCode(certificate.id, "7KQ4MX9T2R");

      const response = await validate(input);

      expect(response.status).toBe(200);
      expect(response.body.validationCode).toBe("7KQ4MX9T2R");
    },
  );

  it.each(["AOBICDEFGH", "AOBLCDEFGH"])(
    "reads the look-alike letters in %j as digits",
    async (input) => {
      const { certificate } = await anIssuedCertificate();
      await withCode(certificate.id, "A0B1CDEFGH");

      const response = await validate(input);

      expect(response.status).toBe(200);
      expect(response.body.validationCode).toBe("A0B1CDEFGH");
    },
  );

  it("answers 404 to an unknown code", async () => {
    const response = await validate("7KQ4MX9T2R");

    expect(response.status).toBe(404);
    expect(response.body).toEqual(NOT_FOUND);
  });

  it.each(["abc", "7KQ4MX9T2RA", "7KQ4MX9T2U"])(
    "answers the malformed %j exactly as an unknown code",
    async (input) => {
      const malformed = await validate(input);
      const unknown = await validate("7KQ4MX9T2R");

      expect(malformed.status).toBe(404);
      expect(malformed.body).toEqual(unknown.body);
    },
  );

  it("answers the same with an invalid session cookie as without one", async () => {
    const { certificate } = await anIssuedCertificate();

    const anonymous = await validate(certificate.validationCode);
    const withBadCookie = await validate(certificate.validationCode).set(
      ...authCookie(invalidToken()),
    );

    expect(anonymous.status).toBe(200);
    expect(withBadCookie.status).toBe(200);
    expect(withBadCookie.body).toEqual(anonymous.body);
  });

  it("keeps validating the certificate of a soft-deleted activity", async () => {
    const { activity, certificate } = await anIssuedCertificate();
    // Deleted after issuing: attendance cannot be homologated on a deleted activity.
    await prisma.activity.update({
      where: { id: activity.id },
      data: { deletedAt: new Date() },
    });

    const response = await validate(certificate.validationCode);

    expect(response.status).toBe(200);
  });

  it("answers 404 once the presence is corrected to an absence", async () => {
    const { activity, enrollment, certificate } = await anIssuedCertificate();
    await new EnrollmentRepository().confirmAttendance(
      activity.id,
      enrollment.id,
      false,
      0,
    );

    const response = await validate(certificate.validationCode);

    expect(response.status).toBe(404);
    expect(response.body).toEqual(NOT_FOUND);
  });
});
