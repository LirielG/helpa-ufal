import type { Request, Response } from "express";
import CertificateService from "@/services/certificate/CertificateService.js";
import type { ICertificateService } from "@/services/certificate/ICertificateService.js";
import type { ICertificateController } from "@/controllers/certificate/ICertificateController.js";
import CustomError from "@/models/error/CustomError.js";

type Props = {
  certificateService?: ICertificateService;
};

class CertificateController implements ICertificateController {
  private _certificateService: ICertificateService;

  constructor(props?: Props) {
    this._certificateService =
      props?.certificateService ?? new CertificateService();
  }

  public async downloadFile(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new CustomError(401, "Unauthenticated.");

    const { fileName, content } = await this._certificateService.getFile(
      req.user.id,
      req.params.certificateId as string,
    );

    // The file name is built from the validation code alone, so it needs no
    // escaping: no accents, quotes or slashes from the activity title.
    res
      .status(200)
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      })
      .send(
        Buffer.from(content.buffer, content.byteOffset, content.byteLength),
      );
  }
}

export default CertificateController;
