import type { Request, Response } from "express";
import type { AuthenticatedUser } from "@/types/auth.js";
import CertificateService from "@/services/certificate/CertificateService.js";
import type { ICertificateService } from "@/services/certificate/ICertificateService.js";
import type { ICertificateController } from "@/controllers/certificate/ICertificateController.js";

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
    const user = req.user as AuthenticatedUser;

    const { fileName, content } = await this._certificateService.getFile(
      user,
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

  public async validate(req: Request, res: Response): Promise<void> {
    const validation = await this._certificateService.validate(
      req.params.validationCode as string,
    );

    // The answer turns into a 404 once the presence is corrected, so no cache
    // may keep showing a certificate as valid.
    res.status(200).set("Cache-Control", "no-store").json(validation);
  }
}

export default CertificateController;
