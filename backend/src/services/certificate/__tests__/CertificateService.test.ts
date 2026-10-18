import { describe, it, expect, vi } from "vitest";
import CertificateService from "../CertificateService.js";
import type {
  CertificateForDownload,
  ICertificateRepository,
} from "@/repositories/certificate/ICertificateRepository.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import type { ICertificatePdfRenderer } from "../ICertificatePdfRenderer.js";
import CustomError from "@/models/error/CustomError.js";
import { expectCustomError } from "@/utils/tests.js";

const CERTIFICATE_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const HOLDER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const OTHER_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

function aCertificate(): CertificateForDownload {
  return {
    id: CERTIFICATE_ID,
    validationCode: "7KQ4MX9T2R",
    issuedAt: new Date("2026-06-11T10:30:00.000Z"),
    enrollment: {
      userId: HOLDER_ID,
      confirmedWorkloadHours: 6,
      user: { fullName: "Maria da Silva" },
      activity: {
        title: "Academic Writing Lecture",
        startDate: new Date("2026-06-10T13:00:00.000Z"),
        endDate: new Date("2026-06-10T17:00:00.000Z"),
      },
    },
  };
}

function setup({
  certificate = aCertificate() as CertificateForDownload | null,
  user = { isManager: false } as { isManager: boolean } | null,
} = {}) {
  const certificateRepository = {
    findByIdForDownload: vi.fn().mockResolvedValue(certificate),
  } as unknown as ICertificateRepository;
  const userRepository = {
    findById: vi.fn().mockResolvedValue(user),
  } as unknown as IUserRepository;
  const renderer: ICertificatePdfRenderer = {
    render: vi.fn().mockResolvedValue(PDF_BYTES),
  };
  const service = new CertificateService({
    certificateRepository,
    userRepository,
    renderer,
  });

  return { service, certificateRepository, renderer };
}

async function notFoundMessage(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(CustomError);
    expect((error as CustomError).statusCode).toBe(404);
    return (error as CustomError).message;
  }
  throw new Error("Expected a 404, but nothing was thrown.");
}

describe("CertificateService.getFile", () => {
  it("hands the holder the rendered PDF, named after the validation code", async () => {
    const { service } = setup();

    const file = await service.getFile(HOLDER_ID, CERTIFICATE_ID);

    expect(file).toEqual({
      fileName: "certificado-7KQ4MX9T2R.pdf",
      content: PDF_BYTES,
    });
  });

  it("renders with the confirmed hours and the current holder name", async () => {
    const { service, renderer } = setup();

    await service.getFile(HOLDER_ID, CERTIFICATE_ID);

    expect(renderer.render).toHaveBeenCalledExactlyOnceWith({
      holderName: "Maria da Silva",
      activityTitle: "Academic Writing Lecture",
      activityStartDate: new Date("2026-06-10T13:00:00.000Z"),
      activityEndDate: new Date("2026-06-10T17:00:00.000Z"),
      workloadHours: 6,
      issuedAt: new Date("2026-06-11T10:30:00.000Z"),
      validationCode: "7KQ4MX9T2R",
    });
  });

  it("hands a manager who is not the holder the PDF", async () => {
    const { service } = setup({ user: { isManager: true } });

    const file = await service.getFile(OTHER_ID, CERTIFICATE_ID);

    expect(file.content).toBe(PDF_BYTES);
  });

  it("answers the same 404 to a non-manager who is not the holder, to an unknown id and to a malformed id", async () => {
    const notOwner = setup();
    const unknown = setup({ certificate: null });
    const malformed = setup();

    const messages = await Promise.all([
      notFoundMessage(notOwner.service.getFile(OTHER_ID, CERTIFICATE_ID)),
      notFoundMessage(unknown.service.getFile(HOLDER_ID, CERTIFICATE_ID)),
      notFoundMessage(malformed.service.getFile(HOLDER_ID, "abc")),
    ]);

    expect(new Set(messages)).toEqual(new Set(["Certificate not found."]));
    expect(notOwner.renderer.render).not.toHaveBeenCalled();
    expect(
      malformed.certificateRepository.findByIdForDownload,
    ).not.toHaveBeenCalled();
  });

  it("answers 401 when the user from the token no longer exists", async () => {
    const { service, renderer } = setup({ user: null });

    await expectCustomError(service.getFile(HOLDER_ID, CERTIFICATE_ID), 401);
    expect(renderer.render).not.toHaveBeenCalled();
  });
});
