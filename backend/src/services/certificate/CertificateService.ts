import CertificateRepository from "@/repositories/certificate/CertificateRepository.js";
import UserRepository from "@/repositories/auth/UserRepository.js";
import type { ICertificateRepository } from "@/repositories/certificate/ICertificateRepository.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import { CertificatePdfRenderer } from "@/services/certificate/CertificatePdfRenderer.js";
import type { ICertificatePdfRenderer } from "@/services/certificate/ICertificatePdfRenderer.js";
import type {
  CertificateFile,
  ICertificateService,
} from "@/services/certificate/ICertificateService.js";
import CustomError from "@/models/error/CustomError.js";
import { isValidUUID } from "@/utils/uuid.js";
import { ACTIVE_ENROLLMENT_STATUS } from "@/types/enrollment.js";

type Props = {
  certificateRepository?: ICertificateRepository;
  userRepository?: IUserRepository;
  renderer?: ICertificatePdfRenderer;
};

class CertificateService implements ICertificateService {
  private _certificateRepository: ICertificateRepository;
  private _userRepository: IUserRepository;
  private _renderer: ICertificatePdfRenderer;

  constructor(props?: Props) {
    this._certificateRepository =
      props?.certificateRepository ?? new CertificateRepository();
    this._userRepository = props?.userRepository ?? new UserRepository();
    this._renderer = props?.renderer ?? new CertificatePdfRenderer();
  }

  public async getFile(
    userId: string,
    certificateId: string,
  ): Promise<CertificateFile> {
    // isManager comes from the database: the token claims only identify the user.
    const user = await this._userRepository.findById(userId);
    if (!user) {
      throw new CustomError(401, "User account not found or inactive.");
    }

    // A malformed id, an unknown one and someone else's certificate share one
    // answer, so the route never confirms that a certificate exists. The
    // activity author is deliberately left out: the homologation screen
    // already shows them everything the PDF would.
    const notFound = new CustomError(404, "Certificate not found.");

    if (!isValidUUID(certificateId)) throw notFound;

    const certificate =
      await this._certificateRepository.findByIdForDownload(certificateId);
    if (!certificate) throw notFound;

    const { enrollment } = certificate;
    if (enrollment.userId !== userId && !user.isManager) throw notFound;

    // Attendance homologation deletes the certificate when presence stops
    // holding, but the PDF attests presence, so it is not handed out on that
    // promise alone: a row left behind by any other write is never rendered.
    if (
      enrollment.status !== ACTIVE_ENROLLMENT_STATUS ||
      enrollment.attendanceConfirmed !== true
    ) {
      throw notFound;
    }

    // Rendered on every request instead of stored, so the PDF always carries
    // the holder's current name and the hours as homologated now.
    const content = await this._renderer.render({
      holderName: enrollment.user.fullName,
      activityTitle: enrollment.activity.title,
      activityStartDate: enrollment.activity.startDate,
      activityEndDate: enrollment.activity.endDate,
      workloadHours: enrollment.confirmedWorkloadHours,
      issuedAt: certificate.issuedAt,
      validationCode: certificate.validationCode,
    });

    return {
      fileName: `certificado-${certificate.validationCode}.pdf`,
      content,
    };
  }
}

export default CertificateService;
