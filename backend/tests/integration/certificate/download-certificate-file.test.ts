import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import EnrollmentRepository from "@/repositories/enrollment/EnrollmentRepository.js";
import CertificateService from "@/services/certificate/CertificateService.js";
import type { ICertificatePdfRenderer } from "@/services/certificate/ICertificatePdfRenderer.js";
import {
  createActivity,
  createEnrollment,
  createManager,
  createStudent,
  createTeacher,
} from "../../helpers/factories.js";
import { authCookie } from "../../helpers/auth.js";

const UNKNOWN_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const NOT_FOUND = { status: 404, message: "Certificate not found." };

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

  return { author, holder, activity, enrollment, certificate };
}

// The PDF arrives as a binary body, which supertest only buffers when told to.
function download(certificateId: string, token?: string) {
  const call = request(app)
    .get(`/certificates/${certificateId}/file`)
    .buffer(true)
    .parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => callback(null, Buffer.concat(chunks)));
    });

  return token ? call.set(...authCookie(token)) : call;
}

function jsonOf(response: request.Response): unknown {
  return JSON.parse((response.body as Buffer).toString("utf8"));
}

describe("GET /certificates/:certificateId/file", () => {
  it("hands the holder the PDF as an attachment named after the validation code", async () => {
    const { holder, certificate } = await anIssuedCertificate();

    const response = await download(certificate.id, holder.token);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("application/pdf");
    expect(response.headers["content-disposition"]).toBe(
      `attachment; filename="certificado-${certificate.validationCode}.pdf"`,
    );
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect((response.body as Buffer).subarray(0, 5).toString("latin1")).toBe(
      "%PDF-",
    );
  });

  it("hands a manager who is not the holder the PDF", async () => {
    const { certificate } = await anIssuedCertificate();
    const manager = await createManager();

    const response = await download(certificate.id, manager.token);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("application/pdf");
  });

  it("answers 404 to the activity author", async () => {
    const { author, certificate } = await anIssuedCertificate();

    const response = await download(certificate.id, author.token);

    expect(response.status).toBe(404);
    expect(jsonOf(response)).toEqual(NOT_FOUND);
  });

  it("answers any other user exactly as it answers an unknown id", async () => {
    const { certificate } = await anIssuedCertificate();
    const stranger = await createStudent();

    const forbidden = await download(certificate.id, stranger.token);
    const unknown = await download(UNKNOWN_ID, stranger.token);

    expect(forbidden.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(jsonOf(forbidden)).toEqual(jsonOf(unknown));
  });

  it("answers a malformed id with the same 404, not a 400", async () => {
    const { holder } = await anIssuedCertificate();

    const response = await download("abc", holder.token);

    expect(response.status).toBe(404);
    expect(jsonOf(response)).toEqual(NOT_FOUND);
  });

  it("answers 401 without a session cookie", async () => {
    const { certificate } = await anIssuedCertificate();

    const response = await download(certificate.id);

    expect(response.status).toBe(401);
  });

  it("keeps the certificate of a soft-deleted activity downloadable by the holder", async () => {
    const { holder, activity, certificate } = await anIssuedCertificate();
    // Deleted after issuing: attendance cannot be homologated on a deleted activity.
    await prisma.activity.update({
      where: { id: activity.id },
      data: { deletedAt: new Date() },
    });

    const response = await download(certificate.id, holder.token);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("application/pdf");
  });

  it("renders the hours as corrected after issuing", async () => {
    const { holder, activity, enrollment, certificate } =
      await anIssuedCertificate();
    await new EnrollmentRepository().confirmAttendance(
      activity.id,
      enrollment.id,
      true,
      6,
    );
    const renderer: ICertificatePdfRenderer = {
      render: vi.fn().mockResolvedValue(new Uint8Array()),
    };

    await new CertificateService({ renderer }).getFile(
      holder.user.id,
      certificate.id,
    );

    expect(renderer.render).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ workloadHours: 6 }),
    );
  });
});
