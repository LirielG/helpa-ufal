import { describe, it, expect, vi } from "vitest";
import CertificateService from "../CertificateService.js";
import type {
  CertificateForDownload,
  CertificateForValidation,
  ICertificateRepository,
} from "@/repositories/certificate/ICertificateRepository.js";
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
      status: "APPROVED",
      attendanceConfirmed: true,
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
} = {}) {
  const certificateRepository = {
    findByIdForDownload: vi.fn().mockResolvedValue(certificate),
  } as unknown as ICertificateRepository;
  const renderer: ICertificatePdfRenderer = {
    render: vi.fn().mockResolvedValue(PDF_BYTES),
  };
  const service = new CertificateService({
    certificateRepository,
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

    const file = await service.getFile(
      { id: HOLDER_ID, isManager: false },
      CERTIFICATE_ID,
    );

    expect(file).toEqual({
      fileName: "certificado-7KQ4MX9T2R.pdf",
      content: PDF_BYTES,
    });
  });

  it("renders with the confirmed hours and the current holder name", async () => {
    const { service, renderer } = setup();

    await service.getFile({ id: HOLDER_ID, isManager: false }, CERTIFICATE_ID);

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

  it("authorizes the manager supplied by authentication", async () => {
    const { service } = setup();

    const file = await service.getFile(
      { id: OTHER_ID, isManager: true },
      CERTIFICATE_ID,
    );

    expect(file.content).toBe(PDF_BYTES);
  });

  it("hands a manager who is not the holder the PDF", async () => {
    const { service } = setup();

    const file = await service.getFile(
      { id: OTHER_ID, isManager: true },
      CERTIFICATE_ID,
    );

    expect(file.content).toBe(PDF_BYTES);
  });

  it("answers the same 404 to a non-manager who is not the holder, to an unknown id and to a malformed id", async () => {
    const notOwner = setup();
    const unknown = setup({ certificate: null });
    const malformed = setup();

    const messages = await Promise.all([
      notFoundMessage(
        notOwner.service.getFile(
          { id: OTHER_ID, isManager: false },
          CERTIFICATE_ID,
        ),
      ),
      notFoundMessage(
        unknown.service.getFile(
          { id: HOLDER_ID, isManager: false },
          CERTIFICATE_ID,
        ),
      ),
      notFoundMessage(
        malformed.service.getFile({ id: HOLDER_ID, isManager: false }, "abc"),
      ),
    ]);

    expect(new Set(messages)).toEqual(new Set(["Certificate not found."]));
    expect(notOwner.renderer.render).not.toHaveBeenCalled();
    expect(
      malformed.certificateRepository.findByIdForDownload,
    ).not.toHaveBeenCalled();
  });

  it.each([
    ["the attendance is no longer confirmed", { attendanceConfirmed: false }],
    [
      "the attendance was reset to not homologated",
      { attendanceConfirmed: null },
    ],
    ["the enrollment is no longer APPROVED", { status: "CANCELLED" }],
  ] as const)(
    "answers the same 404, without rendering, when %s",
    async (_label, enrollmentOverrides) => {
      const certificate = aCertificate();
      Object.assign(certificate.enrollment, enrollmentOverrides);
      const { service, renderer } = setup({ certificate });

      const message = await notFoundMessage(
        service.getFile({ id: HOLDER_ID, isManager: false }, CERTIFICATE_ID),
      );

      expect(message).toBe("Certificate not found.");
      expect(renderer.render).not.toHaveBeenCalled();
    },
  );
});

// Shaped exactly like the repository's select, so a field the query does not
// load cannot leak into the validation through the fixture.
function aValidatedCertificate(): CertificateForValidation {
  return {
    validationCode: "7KQ4MX9T2R",
    issuedAt: new Date("2026-06-11T10:30:00.000Z"),
    enrollment: {
      status: "APPROVED",
      attendanceConfirmed: true,
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

function setupValidation(
  certificate: CertificateForValidation | null = aValidatedCertificate(),
) {
  const certificateRepository = {
    findByValidationCode: vi.fn().mockResolvedValue(certificate),
  } as unknown as ICertificateRepository;
  const service = new CertificateService({
    certificateRepository,
    renderer: {} as ICertificatePdfRenderer,
  });

  return { service, certificateRepository };
}

describe("CertificateService.validate", () => {
  it("answers exactly what the PDF attests", async () => {
    const { service } = setupValidation();

    const validation = await service.validate("7KQ4MX9T2R");

    expect(validation).toStrictEqual({
      validationCode: "7KQ4MX9T2R",
      holderName: "Maria da Silva",
      activityTitle: "Academic Writing Lecture",
      activityStartDate: new Date("2026-06-10T13:00:00.000Z"),
      activityEndDate: new Date("2026-06-10T17:00:00.000Z"),
      workloadHours: 6,
      issuedAt: new Date("2026-06-11T10:30:00.000Z"),
    });
  });

  it.each([
    ["7kq4mx9t2r", "7KQ4MX9T2R"],
    ["7KQ4M-X9T2R", "7KQ4MX9T2R"],
    [" 7KQ4M X9T2R ", "7KQ4MX9T2R"],
    ["AOBICDEFGH", "A0B1CDEFGH"],
    ["AOBLCDEFGH", "A0B1CDEFGH"],
  ])("looks %j up as %s", async (input, stored) => {
    const { service, certificateRepository } = setupValidation();

    await service.validate(input);

    expect(
      certificateRepository.findByValidationCode,
    ).toHaveBeenCalledExactlyOnceWith(stored);
  });

  it.each(["abc", "7KQ4MX9T2RA", "7KQ4MX9T2U"])(
    "answers %j with the 404 of an unknown code, without querying",
    async (input) => {
      const malformed = setupValidation();
      const unknown = setupValidation(null);

      const messages = await Promise.all([
        notFoundMessage(malformed.service.validate(input)),
        notFoundMessage(unknown.service.validate("7KQ4MX9T2R")),
      ]);

      expect(new Set(messages)).toEqual(new Set(["Certificate not found."]));
      expect(
        malformed.certificateRepository.findByValidationCode,
      ).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["the attendance is no longer confirmed", { attendanceConfirmed: false }],
    ["the enrollment is no longer APPROVED", { status: "CANCELLED" }],
  ] as const)("answers 404 when %s", async (_label, enrollmentOverrides) => {
    const certificate = aValidatedCertificate();
    Object.assign(certificate.enrollment, enrollmentOverrides);
    const { service } = setupValidation(certificate);

    const message = await notFoundMessage(service.validate("7KQ4MX9T2R"));

    expect(message).toBe("Certificate not found.");
  });
});
