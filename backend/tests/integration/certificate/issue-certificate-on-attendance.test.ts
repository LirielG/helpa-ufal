import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prisma } from "@/database/prisma.js";
import ActivityRepository from "@/repositories/activity/ActivityRepository.js";
import CertificateRepository from "@/repositories/certificate/CertificateRepository.js";
import EnrollmentRepository from "@/repositories/enrollment/EnrollmentRepository.js";
import {
  createActivity,
  createEnrollment,
  createStudent,
  createTeacher,
} from "../../helpers/factories.js";

// Issuing lives in the repository, not in the route: these tests call
// confirmAttendance directly so they keep holding when #294 rewrites the
// attendance route.

const STORED_CODE = /^[0-9A-HJKMNP-TV-Z]{10}$/;

async function aHomologableEnrollment(
  enrollmentOverrides: Parameters<typeof createEnrollment>[2] = {},
) {
  const author = await createTeacher();
  const activity = await createActivity(author.user.id, {
    status: "COMPLETED",
    workloadHours: 20,
  });
  const volunteer = await createStudent();
  const enrollment = await createEnrollment(
    volunteer.user.id,
    activity.id,
    enrollmentOverrides,
  );

  return { activity, enrollment };
}

function certificateOf(enrollmentId: string) {
  return prisma.certificate.findUnique({ where: { enrollmentId } });
}

function attendanceOf(enrollmentId: string) {
  return prisma.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    select: { attendanceConfirmed: true, confirmedWorkloadHours: true },
  });
}

describe("certificate issuing on attendance confirmation", () => {
  const repository = new EnrollmentRepository();

  it("issues a certificate when presence is confirmed for the first time", async () => {
    const { activity, enrollment } = await aHomologableEnrollment();

    await repository.confirmAttendance(activity.id, enrollment.id, true, 8);

    const certificate = await certificateOf(enrollment.id);
    expect(certificate).toEqual(
      expect.objectContaining({
        enrollmentId: enrollment.id,
        validationCode: expect.stringMatching(STORED_CODE),
        issuedAt: expect.any(Date),
      }),
    );
  });

  it("leaves the certificate untouched when the same hours are confirmed again", async () => {
    const { activity, enrollment } = await aHomologableEnrollment();
    await repository.confirmAttendance(activity.id, enrollment.id, true, 8);
    const issued = await certificateOf(enrollment.id);

    await repository.confirmAttendance(activity.id, enrollment.id, true, 8);

    await expect(certificateOf(enrollment.id)).resolves.toEqual(
      expect.objectContaining({
        id: issued?.id,
        validationCode: issued?.validationCode,
        issuedAt: issued?.issuedAt,
      }),
    );
  });

  it("reissues with the same code when the hours are corrected", async () => {
    const { activity, enrollment } = await aHomologableEnrollment();
    await repository.confirmAttendance(activity.id, enrollment.id, true, 8);
    const issued = await certificateOf(enrollment.id);

    await repository.confirmAttendance(activity.id, enrollment.id, true, 6);

    const reissued = await certificateOf(enrollment.id);
    expect(reissued?.id).toBe(issued?.id);
    expect(reissued?.validationCode).toBe(issued?.validationCode);
    expect(reissued!.issuedAt.getTime()).toBeGreaterThan(
      issued!.issuedAt.getTime(),
    );
  });

  it("deletes the certificate when the presence is corrected into an absence", async () => {
    const { activity, enrollment } = await aHomologableEnrollment();
    await repository.confirmAttendance(activity.id, enrollment.id, true, 8);

    await repository.confirmAttendance(activity.id, enrollment.id, false, 0);

    await expect(certificateOf(enrollment.id)).resolves.toBeNull();
  });

  it("issues a new code when presence is confirmed again after an absence", async () => {
    const { activity, enrollment } = await aHomologableEnrollment();
    await repository.confirmAttendance(activity.id, enrollment.id, true, 8);
    const revoked = await certificateOf(enrollment.id);
    await repository.confirmAttendance(activity.id, enrollment.id, false, 0);

    await repository.confirmAttendance(activity.id, enrollment.id, true, 6);

    const reissued = await certificateOf(enrollment.id);
    expect(reissued?.validationCode).toMatch(STORED_CODE);
    // The printed code of the revoked certificate must stay invalid forever.
    expect(reissued?.validationCode).not.toBe(revoked?.validationCode);
  });

  it("issues nothing when an absence is recorded without a certificate", async () => {
    const { activity, enrollment } = await aHomologableEnrollment();

    await repository.confirmAttendance(activity.id, enrollment.id, false, 0);

    await expect(certificateOf(enrollment.id)).resolves.toBeNull();
  });

  it("issues nothing for an enrollment that is not APPROVED", async () => {
    const { activity, enrollment } = await aHomologableEnrollment({
      status: "PENDING",
    });

    await expect(
      repository.confirmAttendance(activity.id, enrollment.id, true, 8),
    ).rejects.toMatchObject({ statusCode: 409 });

    await expect(certificateOf(enrollment.id)).resolves.toBeNull();
  });

  it("does not record the attendance when writing the certificate fails", async () => {
    const { activity, enrollment } = await aHomologableEnrollment();
    const failing = new CertificateRepository();
    failing.create = async () => {
      throw new Error("certificate write failed");
    };
    const withFailingCertificates = new EnrollmentRepository({
      certificateRepository: failing,
    });

    await expect(
      withFailingCertificates.confirmAttendance(
        activity.id,
        enrollment.id,
        true,
        8,
      ),
    ).rejects.toThrow("certificate write failed");

    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  it("redraws the code when it collides with an existing certificate", async () => {
    const taken = await aHomologableEnrollment();
    await repository.confirmAttendance(
      taken.activity.id,
      taken.enrollment.id,
      true,
      8,
    );
    const takenCode = (await certificateOf(taken.enrollment.id))!
      .validationCode;
    const { activity, enrollment } = await aHomologableEnrollment();
    const draws = [takenCode, "7KQ4MX9T2R"];
    const colliding = new EnrollmentRepository({
      generateValidationCode: () => draws.shift()!,
    });

    await colliding.confirmAttendance(activity.id, enrollment.id, true, 8);

    await expect(certificateOf(enrollment.id)).resolves.toEqual(
      expect.objectContaining({ validationCode: "7KQ4MX9T2R" }),
    );
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: true,
      confirmedWorkloadHours: 8,
    });
  });

  it("gives up after 20 collisions with an error that is not a uniqueness conflict", async () => {
    const taken = await aHomologableEnrollment();
    await repository.confirmAttendance(
      taken.activity.id,
      taken.enrollment.id,
      true,
      8,
    );
    const takenCode = (await certificateOf(taken.enrollment.id))!
      .validationCode;
    const { activity, enrollment } = await aHomologableEnrollment();
    let draws = 0;
    const alwaysColliding = new EnrollmentRepository({
      generateValidationCode: () => {
        draws++;
        return takenCode;
      },
    });

    const error = await alwaysColliding
      .confirmAttendance(activity.id, enrollment.id, true, 8)
      .catch((e: unknown) => e);

    // A raw P2002 would reach the ErrorHandler and be answered as 409 "value
    // already in use"; exhausting the retries is a server fault, so it must
    // surface as a 500.
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(draws).toBe(20);
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  it("keeps the issued certificate when the activity is soft-deleted", async () => {
    const { activity, enrollment } = await aHomologableEnrollment();
    await repository.confirmAttendance(activity.id, enrollment.id, true, 8);
    const issued = await certificateOf(enrollment.id);

    await new ActivityRepository().softDelete(activity.id);

    await expect(certificateOf(enrollment.id)).resolves.toEqual(issued);
  });
});
